-- Service-scoped credential screening.
--
-- Existing provider approvals and historical bookings are preserved, but every
-- new booking must target an active service whose specific credential evidence
-- has been reviewed by an administrator and remains current through the
-- requested service date.

create table if not exists public.provider_service_credential_reviews (
  service_id uuid primary key
    references public.provider_services (id) on delete cascade,
  license_required boolean not null,
  license_credential_ids uuid[] not null default '{}'::uuid[],
  insurance_credential_ids uuid[] not null default '{}'::uuid[],
  reviewed_at timestamptz not null,
  reviewed_by uuid not null
    references public.profiles (id) on delete restrict,
  constraint provider_service_reviews_insurance_required check (
    cardinality(insurance_credential_ids) > 0
  ),
  constraint provider_service_reviews_license_matches_requirement check (
    (license_required and cardinality(license_credential_ids) > 0)
    or (not license_required and cardinality(license_credential_ids) = 0)
  ),
  constraint provider_service_reviews_license_ids_not_null check (
    array_position(license_credential_ids, null) is null
  ),
  constraint provider_service_reviews_insurance_ids_not_null check (
    array_position(insurance_credential_ids, null) is null
  )
);

comment on table public.provider_service_credential_reviews is
  'Current administrator attestation that a provider service is supported by the selected, individually reviewed credential documents.';
comment on column public.provider_service_credential_reviews.license_credential_ids is
  'Approved license evidence selected for this service. Selecting an approved license with no expiration date attests that the license is non-expiring.';
comment on column public.provider_service_credential_reviews.insurance_credential_ids is
  'Approved insurance evidence selected for this service; every selected policy must have a current expiration date.';

create index if not exists provider_service_reviews_license_ids_idx
  on public.provider_service_credential_reviews using gin (license_credential_ids);
create index if not exists provider_service_reviews_insurance_ids_idx
  on public.provider_service_credential_reviews using gin (insurance_credential_ids);

alter table public.provider_service_credential_reviews enable row level security;

revoke all on table public.provider_service_credential_reviews
  from anon, authenticated;
grant select on table public.provider_service_credential_reviews to authenticated;
grant all on table public.provider_service_credential_reviews to service_role;

drop policy if exists "Admins can view service credential reviews"
  on public.provider_service_credential_reviews;
create policy "Admins can view service credential reviews"
  on public.provider_service_credential_reviews
  for select
  to authenticated
  using ((select private.is_admin()));

-- A service is eligible only while the exact evidence selected during its
-- service-scope review still exists in private Storage, remains individually
-- approved, and is current through the requested service date.
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

create or replace function private.provider_has_all_service_credential_reviews(
  requested_provider_id uuid,
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
      where service.provider_id = requested_provider_id
        and service.is_active
    )
    and not exists (
      select 1
      from public.provider_services as service
      where service.provider_id = requested_provider_id
        and service.is_active
        and not private.service_credential_review_is_eligible(
          service.id,
          service_date
        )
    );
$$;

revoke all on function private.provider_has_all_service_credential_reviews(uuid, date)
  from public;

create or replace function private.provider_has_any_service_credential_review(
  requested_provider_id uuid,
  service_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.provider_services as service
    where service.provider_id = requested_provider_id
      and service.is_active
      and private.service_credential_review_is_eligible(
        service.id,
        service_date
      )
  );
$$;

revoke all on function private.provider_has_any_service_credential_review(uuid, date)
  from public;

-- Providers cannot directly mutate service reviews. The RPC locks the active
-- service and selected evidence before taking the provider-scope lock, then
-- rejects stale admin screens through the expected timestamps.
create or replace function public.review_provider_service_credentials(
  reviewed_service_id uuid,
  requires_license boolean,
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

  if cardinality(normalized_insurance_ids) = 0 then
    raise exception 'Select at least one approved insurance document for this service.';
  end if;

  if requires_license and cardinality(normalized_license_ids) = 0 then
    raise exception 'Select at least one approved license for this service.';
  end if;

  if not requires_license and cardinality(normalized_license_ids) > 0 then
    raise exception 'Do not select license documents when this service does not require a license.';
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

  if (
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

  if (
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
    license_credential_ids,
    insurance_credential_ids,
    reviewed_at,
    reviewed_by
  )
  values (
    reviewed_service_id,
    requires_license,
    normalized_license_ids,
    normalized_insurance_ids,
    timezone('utc', now()),
    current_reviewer_id
  )
  on conflict (service_id) do update
  set
    license_required = excluded.license_required,
    license_credential_ids = excluded.license_credential_ids,
    insurance_credential_ids = excluded.insurance_credential_ids,
    reviewed_at = excluded.reviewed_at,
    reviewed_by = excluded.reviewed_by;

  if not private.service_credential_review_is_eligible(
    reviewed_service_id,
    current_date
  ) then
    raise exception 'The service credential review could not be recorded from the selected evidence. Reload and try again.';
  end if;
end;
$$;

revoke all on function public.review_provider_service_credentials(
  uuid, boolean, uuid[], uuid[], timestamptz, timestamptz
) from public;
grant execute on function public.review_provider_service_credentials(
  uuid, boolean, uuid[], uuid[], timestamptz, timestamptz
) to authenticated;

-- Service-scope changes require a fresh service review.
create or replace function private.invalidate_service_credential_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.provider_service_credential_reviews
  where service_id = case when tg_op = 'DELETE' then old.id else new.id end;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists invalidate_service_credential_review_on_service_update
  on public.provider_services;
create trigger invalidate_service_credential_review_on_service_update
  after update of name, description, is_active
  on public.provider_services
  for each row
  when (
    old.name is distinct from new.name
    or old.description is distinct from new.description
    or old.is_active is distinct from new.is_active
  )
  execute function private.invalidate_service_credential_review();

-- Service deletion is covered by the review table's cascading foreign key.

create or replace function private.invalidate_provider_service_reviews_for_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.provider_service_credential_reviews as review
  using public.provider_services as service
  where review.service_id = service.id
    and service.provider_id = new.provider_id;

  return new;
end;
$$;

drop trigger if exists invalidate_service_reviews_on_provider_scope_update
  on public.provider_details;
create trigger invalidate_service_reviews_on_provider_scope_update
  after update of business_name, service_area, travel_radius_miles
  on public.provider_details
  for each row
  when (
    old.business_name is distinct from new.business_name
    or old.service_area is distinct from new.service_area
    or old.travel_radius_miles is distinct from new.travel_radius_miles
  )
  execute function private.invalidate_provider_service_reviews_for_scope();

-- A changed, rejected, or re-approved credential cannot inherit the service
-- attestation made against its earlier state.
create or replace function private.invalidate_service_reviews_for_credential()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_credential_id uuid := case
    when tg_op = 'DELETE' then old.id
    else new.id
  end;
begin
  delete from public.provider_service_credential_reviews
  where license_credential_ids @> array[changed_credential_id]::uuid[]
     or insurance_credential_ids @> array[changed_credential_id]::uuid[];

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists invalidate_service_reviews_on_credential_update
  on public.provider_credentials;
create trigger invalidate_service_reviews_on_credential_update
  after update of credential_type, title, issuer, credential_number, expires_on,
    document_path, review_status, reviewed_at, reviewed_by
  on public.provider_credentials
  for each row
  when (
    old.credential_type is distinct from new.credential_type
    or old.title is distinct from new.title
    or old.issuer is distinct from new.issuer
    or old.credential_number is distinct from new.credential_number
    or old.expires_on is distinct from new.expires_on
    or old.document_path is distinct from new.document_path
    or old.review_status is distinct from new.review_status
    or old.reviewed_at is distinct from new.reviewed_at
    or old.reviewed_by is distinct from new.reviewed_by
  )
  execute function private.invalidate_service_reviews_for_credential();

drop trigger if exists invalidate_service_reviews_on_credential_delete
  on public.provider_credentials;
create trigger invalidate_service_reviews_on_credential_delete
  after delete on public.provider_credentials
  for each row execute function private.invalidate_service_reviews_for_credential();

-- Registered credential objects become immutable to provider clients. The
-- normal removal workflow deletes the credential row first, after which this
-- policy allows its owning provider to remove the now-unregistered file.
drop policy if exists "Providers delete their own credential files"
  on storage.objects;
create policy "Providers delete their own credential files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'provider-credentials'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1
      from public.provider_credentials as credential
      where credential.provider_id = (select auth.uid())
        and credential.document_path = name
    )
  );

-- No existing provider status or booking history is changed. The next attempted
-- provider approval must pass every active service.
create or replace function private.require_service_reviews_before_provider_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'provider'
    and new.provider_status = 'approved'
    and old.provider_status is distinct from new.provider_status
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

drop trigger if exists require_service_reviews_before_provider_approval
  on public.profiles;
create trigger require_service_reviews_before_provider_approval
  before update of provider_status on public.profiles
  for each row execute function private.require_service_reviews_before_provider_approval();

-- The same trigger protects both creation and pending-to-accepted transitions.
-- Declines, cancellations, and already-accepted historical bookings are not
-- changed or revalidated.
create or replace function private.require_service_review_before_booking_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_license_ids uuid[];
  selected_insurance_ids uuid[];
begin
  if tg_op = 'UPDATE'
    and not (
      old.status = 'pending'
      and new.status = 'accepted'
    )
  then
    return new;
  end if;

  -- Lock mutable evidence in the same stable order used by the review RPC.
  perform service.id
  from public.provider_services as service
  where service.id = new.service_id
    and service.provider_id = new.provider_id
    and service.is_active
  for share;

  if not found then
    raise exception 'This service is not currently available for booking. Its required credentials must be current on the requested date.';
  end if;

  select review.license_credential_ids, review.insurance_credential_ids
  into selected_license_ids, selected_insurance_ids
  from public.provider_service_credential_reviews as review
  where review.service_id = new.service_id;

  if not found then
    raise exception 'This service is not currently available for booking. Its required credentials must be current on the requested date.';
  end if;

  perform credential.id
  from public.provider_credentials as credential
  where credential.id = any(
    coalesce(selected_license_ids, '{}'::uuid[])
    || coalesce(selected_insurance_ids, '{}'::uuid[])
  )
  order by credential.id
  for share;

  perform details.provider_id
  from public.provider_details as details
  where details.provider_id = new.provider_id
  for share;

  if not found then
    raise exception 'This service is not currently available for booking. Its required credentials must be current on the requested date.';
  end if;

  perform profile.id
  from public.profiles as profile
  where profile.id = new.provider_id
    and profile.role = 'provider'
    and profile.provider_status = 'approved'
  for share;

  if not found then
    raise exception 'This service is not currently available for booking. Its required credentials must be current on the requested date.';
  end if;

  perform review.service_id
  from public.provider_service_credential_reviews as review
  where review.service_id = new.service_id
  for share;

  if not found
    or not private.service_credential_review_is_eligible(
      new.service_id,
      greatest(current_date, new.requested_date)
    )
  then
    raise exception 'This service is not currently available for booking. Its required credentials must be current on the requested date.';
  end if;

  return new;
end;
$$;

drop trigger if exists require_service_review_before_booking_write
  on public.booking_requests;
create trigger require_service_review_before_booking_write
  before insert or update of status on public.booking_requests
  for each row execute function private.require_service_review_before_booking_write();

-- Provider-level readiness now means at least one active service is currently
-- eligible. Per-service UI should use get_public_provider_service_checks().
create or replace function public.is_provider_booking_eligible(
  requested_provider_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = requested_provider_id
      and profile.role = 'provider'
      and profile.provider_status = 'approved'
      and private.provider_has_any_service_credential_review(
        requested_provider_id,
        current_date
      )
  );
$$;

revoke all on function public.is_provider_booking_eligible(uuid) from public;
grant execute on function public.is_provider_booking_eligible(uuid)
  to anon, authenticated;

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
        'eligible', eligibility.eligible,
        'checkedAt', case
          when eligibility.eligible then review.reviewed_at
          else null
        end,
        'licenseRequired', coalesce(review.license_required, false),
        'credentials', case
          when eligibility.eligible then coalesce(credentials.items, '[]'::jsonb)
          else '[]'::jsonb
        end
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
  cross join lateral (
    select private.service_credential_review_is_eligible(
      service.id,
      current_date
    ) as eligible
  ) as eligibility
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', credential.id,
        'type', credential.credential_type,
        'title', credential.title,
        'issuer', credential.issuer,
        'expiresOn', credential.expires_on,
        'checkedAt', credential.reviewed_at
      )
      order by credential.credential_type, credential.title, credential.id
    ) as items
    from public.provider_credentials as credential
    where credential.id = any(
      coalesce(review.license_credential_ids, '{}'::uuid[])
      || coalesce(review.insurance_credential_ids, '{}'::uuid[])
    )
  ) as credentials on true
  where profile.id = requested_provider_id
    and profile.role = 'provider'
    and profile.provider_status = 'approved';
$$;

revoke all on function public.get_public_provider_service_checks(uuid) from public;
grant execute on function public.get_public_provider_service_checks(uuid)
  to anon, authenticated;

-- Retain the legacy profile RPC for compatibility, but remove its broad
-- credential summaries. Public service-scoped evidence is available only from
-- get_public_provider_service_checks().
create or replace function public.get_approved_provider(requested_provider_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'providerId', profile.id,
    'displayName', coalesce(nullif(trim(details.business_name), ''), profile.full_name),
    'headline', details.headline,
    'bio', details.bio,
    'serviceArea', details.service_area,
    'yearsExperience', details.years_experience,
    'travelRadiusMiles', details.travel_radius_miles,
    'services', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', service.id,
            'name', service.name,
            'description', service.description,
            'pricingType', service.pricing_type,
            'priceCents', service.price_cents
          )
          order by service.name
        )
        from public.provider_services as service
        where service.provider_id = profile.id
          and service.is_active
      ),
      '[]'::jsonb
    ),
    'availability', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'weekday', availability.weekday,
            'startTime', to_char(availability.start_time, 'HH24:MI'),
            'endTime', to_char(availability.end_time, 'HH24:MI')
          )
          order by availability.weekday
        )
        from public.provider_availability as availability
        where availability.provider_id = profile.id
          and availability.is_available
      ),
      '[]'::jsonb
    ),
    'photos', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', photo.id,
            'storagePath', photo.storage_path,
            'caption', photo.caption
          )
          order by photo.sort_order, photo.created_at
        )
        from public.provider_photos as photo
        where photo.provider_id = profile.id
      ),
      '[]'::jsonb
    ),
    'credentials', '[]'::jsonb
  )
  from public.profiles as profile
  join public.provider_details as details
    on details.provider_id = profile.id
  where profile.id = requested_provider_id
    and profile.role = 'provider'
    and profile.provider_status = 'approved';
$$;

revoke all on function public.get_approved_provider(uuid) from public;
grant execute on function public.get_approved_provider(uuid)
  to anon, authenticated;
