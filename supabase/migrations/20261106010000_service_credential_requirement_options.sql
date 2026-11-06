-- Make license and insurance requirements independent, explicit decisions for
-- every service. Existing service reviews were completed under the earlier
-- blanket-insurance rule, so they are preserved as insurance-required.

alter table public.provider_service_credential_reviews
  add column if not exists insurance_required boolean;

update public.provider_service_credential_reviews
set insurance_required = true
where insurance_required is null;

alter table public.provider_service_credential_reviews
  alter column insurance_required drop default,
  alter column insurance_required set not null;

alter table public.provider_service_credential_reviews
  drop constraint if exists provider_service_reviews_insurance_required;

alter table public.provider_service_credential_reviews
  drop constraint if exists provider_service_reviews_insurance_matches_requirement;

alter table public.provider_service_credential_reviews
  add constraint provider_service_reviews_insurance_matches_requirement check (
    (insurance_required and cardinality(insurance_credential_ids) > 0)
    or (not insurance_required and cardinality(insurance_credential_ids) = 0)
  );

comment on column public.provider_service_credential_reviews.insurance_required is
  'Administrator decision whether this specific service requires current insurance evidence.';
comment on column public.provider_service_credential_reviews.insurance_credential_ids is
  'Approved insurance evidence selected when insurance is required for this service; every selected policy must remain current.';
comment on column public.provider_details.risk_controls_required_at is
  'Legacy rollout marker retained for audit history; booking eligibility is now determined by service-scoped credential reviews.';

-- Eligibility remains fail-closed. Each evidence type is evaluated only when
-- the administrator explicitly marked it required, and a not-required decision
-- is valid only with an empty evidence selection for that type.
create or replace function private.service_credential_review_is_eligible(
  requested_service_id uuid,
  service_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    service_date is not null
    and exists (
      select 1
      from public.provider_services as service
      join public.provider_service_credential_reviews as review
        on review.service_id = service.id
      where service.id = requested_service_id
        and service.is_active
        and (
          (
            not review.insurance_required
            and cardinality(review.insurance_credential_ids) = 0
          )
          or (
            review.insurance_required
            and cardinality(review.insurance_credential_ids) > 0
            and not exists (
              select 1
              from unnest(review.insurance_credential_ids) as selected(credential_id)
              left join public.provider_credentials as credential
                on credential.id = selected.credential_id
               and credential.provider_id = service.provider_id
               and credential.credential_type = 'insurance'
              left join public.profiles as reviewer
                on reviewer.id = credential.reviewed_by
               and reviewer.role = 'admin'
              left join storage.objects as stored_document
                on stored_document.bucket_id = 'provider-credentials'
               and stored_document.name = credential.document_path
              where credential.id is null
                 or credential.review_status <> 'approved'
                 or credential.reviewed_at is null
                 or credential.reviewed_by is null
                 or reviewer.id is null
                 or stored_document.id is null
                 or credential.document_path not like service.provider_id::text || '/%'
                 or char_length(trim(credential.issuer)) = 0
                 or credential.expires_on is null
                 or credential.expires_on < service_date
            )
          )
        )
        and (
          (
            not review.license_required
            and cardinality(review.license_credential_ids) = 0
          )
          or (
            review.license_required
            and cardinality(review.license_credential_ids) > 0
            and not exists (
              select 1
              from unnest(review.license_credential_ids) as selected(credential_id)
              left join public.provider_credentials as credential
                on credential.id = selected.credential_id
               and credential.provider_id = service.provider_id
               and credential.credential_type = 'license'
              left join public.profiles as reviewer
                on reviewer.id = credential.reviewed_by
               and reviewer.role = 'admin'
              left join storage.objects as stored_document
                on stored_document.bucket_id = 'provider-credentials'
               and stored_document.name = credential.document_path
              where credential.id is null
                 or credential.review_status <> 'approved'
                 or credential.reviewed_at is null
                 or credential.reviewed_by is null
                 or reviewer.id is null
                 or stored_document.id is null
                 or credential.document_path not like service.provider_id::text || '/%'
                 or char_length(trim(credential.issuer)) = 0
                 or (
                   credential.expires_on is not null
                   and credential.expires_on < service_date
                 )
            )
          )
        )
    );
$$;

revoke all on function private.service_credential_review_is_eligible(uuid, date)
  from public;

-- Replace the earlier six-argument RPC with the explicit seven-argument
-- contract. Providers still cannot mutate service reviews directly.
drop function if exists public.review_provider_service_credentials(
  uuid, boolean, uuid[], uuid[], timestamptz, timestamptz
);

create function public.review_provider_service_credentials(
  reviewed_service_id uuid,
  requires_license boolean,
  requires_insurance boolean,
  selected_license_ids uuid[],
  selected_insurance_ids uuid[],
  expected_service_updated_at timestamptz,
  expected_profile_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_reviewer_id uuid := (select auth.uid());
  reviewed_provider_id uuid;
  current_service_updated_at timestamptz;
  current_profile_updated_at timestamptz;
  normalized_license_ids uuid[];
  normalized_insurance_ids uuid[];
  all_selected_ids uuid[];
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_reviewer_id
      and role = 'admin'
  ) then
    raise exception 'Only administrators can review service credentials.';
  end if;

  if requires_license is null then
    raise exception 'Choose whether this service requires a license.';
  end if;

  if requires_insurance is null then
    raise exception 'Choose whether this service requires insurance.';
  end if;

  if array_position(coalesce(selected_license_ids, '{}'::uuid[]), null) is not null
    or array_position(coalesce(selected_insurance_ids, '{}'::uuid[]), null) is not null
  then
    raise exception 'Credential selections cannot contain empty values.';
  end if;

  select coalesce(array_agg(selected_id order by selected_id), '{}'::uuid[])
  into normalized_license_ids
  from (
    select distinct selected_id
    from unnest(coalesce(selected_license_ids, '{}'::uuid[])) as input(selected_id)
  ) as selected;

  select coalesce(array_agg(selected_id order by selected_id), '{}'::uuid[])
  into normalized_insurance_ids
  from (
    select distinct selected_id
    from unnest(coalesce(selected_insurance_ids, '{}'::uuid[])) as input(selected_id)
  ) as selected;

  if requires_license and cardinality(normalized_license_ids) = 0 then
    raise exception 'Select at least one approved license for this service.';
  end if;

  if not requires_license and cardinality(normalized_license_ids) > 0 then
    raise exception 'Do not select license documents when this service does not require a license.';
  end if;

  if requires_insurance and cardinality(normalized_insurance_ids) = 0 then
    raise exception 'Select at least one approved insurance document for this service.';
  end if;

  if not requires_insurance and cardinality(normalized_insurance_ids) > 0 then
    raise exception 'Do not select insurance documents when this service does not require insurance.';
  end if;

  select service.provider_id, service.updated_at
  into reviewed_provider_id, current_service_updated_at
  from public.provider_services as service
  where service.id = reviewed_service_id
    and service.is_active
  for update;

  if not found then
    raise exception 'Choose an active provider service to review.';
  end if;

  if expected_service_updated_at is null
    or current_service_updated_at is distinct from expected_service_updated_at
  then
    raise exception 'This service changed while it was being reviewed. Reload and review the current service.';
  end if;

  all_selected_ids := normalized_license_ids || normalized_insurance_ids;

  perform credential.id
  from public.provider_credentials as credential
  where credential.id = any(all_selected_ids)
  order by credential.id
  for update;

  if requires_license and (
    select count(*)
    from public.provider_credentials as credential
    join public.profiles as reviewer
      on reviewer.id = credential.reviewed_by
     and reviewer.role = 'admin'
    join storage.objects as stored_document
      on stored_document.bucket_id = 'provider-credentials'
     and stored_document.name = credential.document_path
    where credential.id = any(normalized_license_ids)
      and credential.provider_id = reviewed_provider_id
      and credential.credential_type = 'license'
      and credential.review_status = 'approved'
      and credential.reviewed_at is not null
      and credential.reviewed_by is not null
      and credential.document_path like reviewed_provider_id::text || '/%'
      and char_length(trim(credential.issuer)) > 0
      and (
        credential.expires_on is null
        or credential.expires_on >= current_date
      )
  ) <> cardinality(normalized_license_ids) then
    raise exception 'Every selected license must be individually approved, current, issued to this provider, and have an issuer and private document.';
  end if;

  if requires_insurance and (
    select count(*)
    from public.provider_credentials as credential
    join public.profiles as reviewer
      on reviewer.id = credential.reviewed_by
     and reviewer.role = 'admin'
    join storage.objects as stored_document
      on stored_document.bucket_id = 'provider-credentials'
     and stored_document.name = credential.document_path
    where credential.id = any(normalized_insurance_ids)
      and credential.provider_id = reviewed_provider_id
      and credential.credential_type = 'insurance'
      and credential.review_status = 'approved'
      and credential.reviewed_at is not null
      and credential.reviewed_by is not null
      and credential.document_path like reviewed_provider_id::text || '/%'
      and char_length(trim(credential.issuer)) > 0
      and credential.expires_on is not null
      and credential.expires_on >= current_date
  ) <> cardinality(normalized_insurance_ids) then
    raise exception 'Every selected insurance document must be individually approved, current, issued to this provider, and have a carrier, expiration date, and private document.';
  end if;

  select details.updated_at
  into current_profile_updated_at
  from public.provider_details as details
  where details.provider_id = reviewed_provider_id
  for update;

  if not found then
    raise exception 'Provider profile details were not found.';
  end if;

  if expected_profile_updated_at is null
    or current_profile_updated_at is distinct from expected_profile_updated_at
  then
    raise exception 'This provider profile changed while it was being reviewed. Reload and review the current service area.';
  end if;

  insert into public.provider_service_credential_reviews (
    service_id,
    license_required,
    insurance_required,
    license_credential_ids,
    insurance_credential_ids,
    reviewed_at,
    reviewed_by
  )
  values (
    reviewed_service_id,
    requires_license,
    requires_insurance,
    normalized_license_ids,
    normalized_insurance_ids,
    timezone('utc', now()),
    current_reviewer_id
  )
  on conflict (service_id) do update
  set
    license_required = excluded.license_required,
    insurance_required = excluded.insurance_required,
    license_credential_ids = excluded.license_credential_ids,
    insurance_credential_ids = excluded.insurance_credential_ids,
    reviewed_at = excluded.reviewed_at,
    reviewed_by = excluded.reviewed_by;

  if not private.service_credential_review_is_eligible(
    reviewed_service_id,
    current_date
  ) then
    raise exception 'The service credential review could not be recorded from the selected decisions and evidence. Reload and try again.';
  end if;
end;
$$;

revoke all on function public.review_provider_service_credentials(
  uuid, boolean, boolean, uuid[], uuid[], timestamptz, timestamptz
) from public;
grant execute on function public.review_provider_service_credentials(
  uuid, boolean, boolean, uuid[], uuid[], timestamptz, timestamptz
) to authenticated;

-- Credential evidence is now service-scoped. Content changes and review
-- decisions already invalidate every service review that selected the changed
-- document, so the legacy application-wide credential-change trigger would be
-- both broader and less accurate than the new fail-closed service guard.
drop trigger if exists mark_provider_credentials_changed
  on public.provider_credentials;

-- Preserve individual document review and its audit trail without demoting an
-- entire approved provider merely because the last insurance document was
-- rejected. The service-review invalidation trigger pauses only services that
-- selected the rejected evidence.
create or replace function public.review_provider_credential(
  reviewed_credential_id uuid,
  review_decision text,
  review_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_reviewer_id uuid := (select auth.uid());
  reviewed_credential_type text;
  reviewed_issuer text;
  reviewed_expires_on date;
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_reviewer_id
      and role = 'admin'
  ) then
    raise exception 'Only administrators can review provider credentials.';
  end if;

  if review_decision is null
    or review_decision not in ('approved', 'rejected')
  then
    raise exception 'Choose an approved or rejected credential review.';
  end if;

  if review_decision = 'rejected'
    and char_length(trim(coalesce($3, ''))) < 10
  then
    raise exception 'Add clear review notes when rejecting a credential.';
  end if;

  select
    credential.credential_type,
    credential.issuer,
    credential.expires_on
  into
    reviewed_credential_type,
    reviewed_issuer,
    reviewed_expires_on
  from public.provider_credentials as credential
  where credential.id = reviewed_credential_id
  for update;

  if not found then
    raise exception 'Credential was not found.';
  end if;

  if review_decision = 'approved'
    and reviewed_credential_type = 'insurance'
    and (
      char_length(trim(coalesce(reviewed_issuer, ''))) = 0
      or reviewed_expires_on is null
      or reviewed_expires_on < current_date
    )
  then
    raise exception 'A current insurance credential needs a carrier and an unexpired expiration date before approval.';
  end if;

  update public.provider_credentials
  set
    review_status = review_decision,
    review_notes = case
      when review_decision = 'approved' then ''
      else trim(coalesce($3, ''))
    end,
    reviewed_at = timezone('utc', now()),
    reviewed_by = current_reviewer_id
  where id = reviewed_credential_id;
end;
$$;

revoke all on function public.review_provider_credential(uuid, text, text)
  from public;
grant execute on function public.review_provider_credential(uuid, text, text)
  to authenticated;

-- Provider submission checks profile completeness and current legal
-- acceptances. Credential requirements are decided later, service by service,
-- by an administrator and therefore cannot be a blanket submission rule.
create or replace function public.submit_provider_application(
  provider_legal_acknowledged boolean,
  accepted_provider_agreement_version text,
  accepted_provider_standards_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_provider_id uuid := (select auth.uid());
  current_provider_agreement_version text;
  current_provider_standards_version text;
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_provider_id
      and role = 'provider'
  ) then
    raise exception 'Only providers can submit an application.';
  end if;

  if exists (
    with current_all_documents as (
      select distinct on (version.document_key)
        version.document_key,
        version.document_version
      from public.legal_document_versions as version
      where version.audience = 'all'
        and version.effective_at <= timezone('utc', now())
      order by version.document_key, version.effective_at desc, version.created_at desc
    )
    select 1
    from current_all_documents as document
    where not exists (
      select 1
      from public.legal_acceptances as acceptance
      where acceptance.user_id = current_provider_id
        and acceptance.document_key = document.document_key
        and acceptance.document_version = document.document_version
    )
  ) then
    raise exception 'Review and accept the current Terms of Service and Privacy Policy before submitting.';
  end if;

  if provider_legal_acknowledged is not true then
    raise exception 'Review and accept the current Provider Agreement and Provider Standards before submitting.';
  end if;

  select version.document_version
  into current_provider_agreement_version
  from public.legal_document_versions as version
  where version.document_key = 'provider_agreement'
    and version.audience = 'provider'
    and version.effective_at <= timezone('utc', now())
  order by version.effective_at desc, version.created_at desc
  limit 1;

  select version.document_version
  into current_provider_standards_version
  from public.legal_document_versions as version
  where version.document_key = 'provider_standards'
    and version.audience = 'provider'
    and version.effective_at <= timezone('utc', now())
  order by version.effective_at desc, version.created_at desc
  limit 1;

  if accepted_provider_agreement_version is distinct from current_provider_agreement_version
    or accepted_provider_standards_version is distinct from current_provider_standards_version
  then
    raise exception 'The provider agreements changed. Review the current versions and try again.';
  end if;

  perform public.record_current_legal_acceptances(
    array['provider_agreement', 'provider_standards']::text[],
    'provider_application',
    null
  );

  if not exists (
    select 1
    from public.provider_details
    where provider_id = current_provider_id
      and char_length(trim(headline)) >= 10
      and char_length(trim(bio)) >= 80
      and char_length(trim(service_area)) >= 2
  ) then
    raise exception 'Complete your introduction and service area before submitting.';
  end if;

  if not exists (
    select 1
    from public.provider_services
    where provider_id = current_provider_id
      and is_active
  ) then
    raise exception 'Add at least one active service before submitting.';
  end if;

  if not exists (
    select 1
    from public.provider_photos
    where provider_id = current_provider_id
  ) then
    raise exception 'Add at least one profile photo before submitting.';
  end if;

  if not exists (
    select 1
    from public.provider_availability
    where provider_id = current_provider_id
      and is_available
  ) then
    raise exception 'Add at least one available day before submitting.';
  end if;

  update public.provider_details
  set
    submitted_at = timezone('utc', now()),
    reviewed_at = null,
    reviewed_by = null
  where provider_id = current_provider_id;

  update public.profiles
  set provider_status = 'pending'
  where id = current_provider_id;
end;
$$;

revoke all on function public.submit_provider_application(boolean, text, text)
  from public;
grant execute on function public.submit_provider_application(boolean, text, text)
  to authenticated;

-- Application approval now consumes the service-scoped decisions. Services
-- marked as requiring neither type are valid reviews; services requiring one
-- or both types must have current selected evidence through the shared helper.
create or replace function public.review_provider_application(
  reviewed_provider_id uuid,
  review_decision text,
  review_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_reviewer_id uuid := (select auth.uid());
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_reviewer_id
      and role = 'admin'
  ) then
    raise exception 'Only administrators can review provider applications.';
  end if;

  if review_decision is null
    or review_decision not in ('approved', 'rejected')
  then
    raise exception 'Choose an approved or rejected decision.';
  end if;

  if review_decision = 'rejected'
    and char_length(trim(coalesce($3, ''))) < 10
  then
    raise exception 'Add clear review notes when rejecting an application.';
  end if;

  perform 1
  from public.provider_details
  where provider_id = reviewed_provider_id
    and submitted_at is not null
  for update;

  if not found then
    raise exception 'This provider has not submitted a complete application.';
  end if;

  if review_decision = 'approved' and (
    not private.provider_has_all_service_credential_reviews(
      reviewed_provider_id,
      current_date
    )
    or not exists (
      select 1
      from public.provider_photos
      where provider_id = reviewed_provider_id
    )
    or not exists (
      select 1
      from public.provider_availability
      where provider_id = reviewed_provider_id
        and is_available
    )
  ) then
    raise exception 'The provider application needs current credential decisions for every active service and all required profile sections before approval.';
  end if;

  update public.profiles
  set provider_status = review_decision::public.provider_status
  where id = reviewed_provider_id
    and role = 'provider';

  if not found then
    raise exception 'Provider account not found.';
  end if;

  update public.provider_details
  set
    reviewed_at = timezone('utc', now()),
    reviewed_by = current_reviewer_id
  where provider_id = reviewed_provider_id;

  insert into public.provider_review_events (
    provider_id,
    reviewer_id,
    decision,
    notes
  )
  values (
    reviewed_provider_id,
    current_reviewer_id,
    review_decision::public.provider_status,
    trim(coalesce($3, ''))
  );
end;
$$;

revoke all on function public.review_provider_application(uuid, text, text)
  from public;
grant execute on function public.review_provider_application(uuid, text, text)
  to authenticated;

-- Gate every explicit approval write, including an approved-to-approved review,
-- while leaving untouched legacy approved rows listed until an action occurs.
create or replace function private.require_service_reviews_before_provider_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'provider'
    and new.provider_status = 'approved'
    and not private.provider_has_all_service_credential_reviews(
      new.id,
      current_date
    )
  then
    raise exception 'Review the required credentials for every active service before approving this provider.';
  end if;

  return new;
end;
$$;

-- Remove the former provider-wide insurance precondition from the request
-- path. The booking table's fail-closed trigger remains the authoritative,
-- concurrency-safe service and requested-date credential guard.
create or replace function public.request_booking(
  requested_provider_id uuid,
  requested_service_id uuid,
  requested_date date,
  requested_start_time time,
  requested_location text,
  requested_notes text default '',
  provider_responsibility_acknowledged boolean default false,
  accepted_terms_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer_id uuid := (select auth.uid());
  customer_display_name text;
  provider_display_name text;
  selected_service record;
  created_booking_id uuid;
  current_terms_version text;
begin
  select full_name
  into customer_display_name
  from public.profiles
  where id = current_customer_id
    and role = 'customer';

  if customer_display_name is null then
    raise exception 'Only customer accounts can request a booking.';
  end if;

  if provider_responsibility_acknowledged is distinct from true then
    raise exception 'Confirm that the provider performs the service and accept the current Terms of Service.';
  end if;

  if exists (
    with current_account_documents as (
      select distinct on (version.document_key)
        version.document_key,
        version.document_version
      from public.legal_document_versions as version
      where version.audience = 'all'
        and version.effective_at <= timezone('utc', now())
      order by version.document_key, version.effective_at desc, version.created_at desc
    )
    select 1
    from current_account_documents as document
    where not exists (
      select 1
      from public.legal_acceptances as acceptance
      where acceptance.user_id = current_customer_id
        and acceptance.document_key = document.document_key
        and acceptance.document_version = document.document_version
    )
  ) then
    raise exception 'Review and accept the current account agreements before requesting a booking.';
  end if;

  select version.document_version
  into current_terms_version
  from public.legal_document_versions as version
  where version.document_key = 'terms'
    and version.effective_at <= timezone('utc', now())
  order by version.effective_at desc, version.created_at desc
  limit 1;

  if current_terms_version is null
    or accepted_terms_version is distinct from current_terms_version
  then
    raise exception 'The Terms of Service changed. Refresh this page, review the current Terms, and try again.';
  end if;

  select coalesce(nullif(trim(details.business_name), ''), profile.full_name)
  into provider_display_name
  from public.profiles as profile
  join public.provider_details as details
    on details.provider_id = profile.id
  where profile.id = requested_provider_id
    and profile.role = 'provider'
    and profile.provider_status = 'approved';

  if provider_display_name is null then
    raise exception 'This provider is not currently available for booking.';
  end if;

  select service.id, service.name, service.pricing_type, service.price_cents
  into selected_service
  from public.provider_services as service
  where service.id = requested_service_id
    and service.provider_id = requested_provider_id
    and service.is_active;

  if not found then
    raise exception 'Choose an active service from this provider.';
  end if;

  if requested_date is null
    or requested_date <= current_date
    or requested_date > current_date + 365
  then
    raise exception 'Choose a date between tomorrow and one year from today.';
  end if;

  if requested_start_time is null or not exists (
    select 1
    from public.provider_availability as availability
    where availability.provider_id = requested_provider_id
      and availability.weekday = extract(dow from requested_date)::smallint
      and availability.is_available
      and availability.start_time <= requested_start_time
      and availability.end_time > requested_start_time
  ) then
    raise exception 'Choose a time within this provider''s listed availability.';
  end if;

  if char_length(trim(coalesce(requested_location, ''))) < 5
    or char_length(trim(coalesce(requested_location, ''))) > 300
  then
    raise exception 'Enter a service location between 5 and 300 characters.';
  end if;

  if char_length(trim(coalesce(requested_notes, ''))) > 2000 then
    raise exception 'Use 2,000 characters or fewer for request notes.';
  end if;

  if (
    select count(*)
    from public.booking_requests
    where customer_id = current_customer_id
      and status = 'pending'
  ) >= 20 then
    raise exception 'You already have 20 pending requests. Wait for a response or cancel one.';
  end if;

  insert into public.booking_requests (
    customer_id,
    provider_id,
    service_id,
    customer_name,
    provider_name,
    service_name,
    pricing_type,
    price_cents,
    requested_date,
    requested_start_time,
    service_location,
    customer_notes
  )
  values (
    current_customer_id,
    requested_provider_id,
    selected_service.id,
    customer_display_name,
    provider_display_name,
    selected_service.name,
    selected_service.pricing_type,
    selected_service.price_cents,
    requested_date,
    requested_start_time,
    trim(requested_location),
    trim(coalesce(requested_notes, ''))
  )
  returning id into created_booking_id;

  perform public.record_current_legal_acceptances(
    array['terms']::text[],
    'booking_request',
    created_booking_id
  );

  return created_booking_id;
exception
  when unique_violation then
    raise exception 'You already have an active request for this provider at that time.';
end;
$$;

revoke all on function public.request_booking(
  uuid, uuid, date, time, text, text, boolean, text
) from public;
grant execute on function public.request_booking(
  uuid, uuid, date, time, text, text, boolean, text
) to authenticated;

-- Public consumers receive only the minimum service-level decision state. No
-- document identifiers, titles, issuers, dates, or review timestamps leave the
-- private review/credential tables.
create or replace function public.get_public_provider_service_checks(
  requested_provider_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'serviceId', service.id,
        'eligible', private.service_credential_review_is_eligible(
          service.id,
          current_date
        ),
        'licenseRequired', coalesce(review.license_required, false),
        'insuranceRequired', coalesce(review.insurance_required, false)
      )
      order by service.name, service.id
    ),
    '[]'::jsonb
  )
  from public.profiles as profile
  join public.provider_services as service
    on service.provider_id = profile.id
   and service.is_active
  left join public.provider_service_credential_reviews as review
    on review.service_id = service.id
  where profile.id = requested_provider_id
    and profile.role = 'provider'
    and profile.provider_status = 'approved';
$$;

revoke all on function public.get_public_provider_service_checks(uuid)
  from public;
grant execute on function public.get_public_provider_service_checks(uuid)
  to anon, authenticated;
