-- Provider risk controls for new or edited services and future application
-- submissions. This migration deliberately does not update existing provider
-- rows or change any currently approved provider status.

create or replace function private.reject_restricted_provider_service()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  service_text text := lower(
    coalesce(new.name, '') || ' ' || coalesce(new.description, '')
  );
begin
  if service_text ~
    '(^|[^a-z0-9])(chiropractic|chiropractor|chiropractors|healthcare|medical|clinical|physician|physicians|doctor|doctors|nurse|nurses|nursing|dental|dentist|dentists|dentistry|psychotherapy|psychotherapist|psychotherapists|diagnose|diagnoses|diagnosis|diagnostic|diagnostics|prescription|acupuncture|acupuncturist|acupuncturists|pharmacy|pharmacist|pharmacists|surgery|surgeon|surgeons|ambulance|paramedic|paramedics|emt|midwife|midwives|doula|doulas|veterinary|veterinarian|veterinarians)([^a-z0-9]|$)'
    or service_text ~
    '(^|[^a-z0-9])(health[ -]+care|mental[ -]+health|behavioral[ -]+health|home[ -]+health|patient[ -]+care|primary[ -]+care|urgent[ -]+care|medical[ -]+care|clinical[ -]+care|physical[ -]+therapy|occupational[ -]+therapy|speech[ -]+therapy|massage[ -]+therapy|emergency[ -]+medical|emergency[ -]+health|emergency[ -]+clinical|emergency[ -]+response|emergency[ -]+care)([^a-z0-9]|$)'
  then
    raise exception 'Restricted service: healthcare, chiropractic, medical, clinical, patient-care, and emergency-response services cannot be listed on Auxilium.';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_restricted_provider_service
  on public.provider_services;
create trigger reject_restricted_provider_service
  before insert or update on public.provider_services
  for each row execute function private.reject_restricted_provider_service();

-- Preserve who made each credential decision and when. Providers retain
-- update access only to the credential's descriptive/document fields below;
-- review evidence is administrator-controlled.
alter table public.provider_credentials
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid
    references public.profiles (id) on delete set null;

revoke update on table public.provider_credentials from authenticated;
grant update (
  credential_type,
  title,
  issuer,
  credential_number,
  expires_on,
  document_path
) on table public.provider_credentials to authenticated;

-- If a provider changes an already-reviewed credential, make the document
-- pending again. Admin review-status changes do not touch these content fields.
create or replace function private.reset_provider_credential_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.review_status := 'pending';
  new.review_notes := '';
  new.reviewed_at := null;
  new.reviewed_by := null;
  return new;
end;
$$;

drop trigger if exists reset_provider_credential_review
  on public.provider_credentials;
create trigger reset_provider_credential_review
  before update of credential_type, title, issuer, credential_number,
    expires_on, document_path
  on public.provider_credentials
  for each row execute function private.reset_provider_credential_review();

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
  reviewed_provider_id uuid;
  reviewed_credential_type text;
  reviewed_issuer text;
  reviewed_expires_on date;
begin
  if not exists (
    select 1 from public.profiles
    where id = current_reviewer_id and role = 'admin'
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
    credential.provider_id,
    credential.credential_type,
    credential.issuer,
    credential.expires_on
  into
    reviewed_provider_id,
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

  if review_decision = 'approved'
    and reviewed_credential_type = 'insurance'
  then
    update public.provider_details
    set risk_controls_required_at = coalesce(
      risk_controls_required_at,
      timezone('utc', now())
    )
    where provider_id = reviewed_provider_id;
  end if;

  if review_decision = 'rejected'
    and reviewed_credential_type = 'insurance'
    and not exists (
      select 1
      from public.provider_credentials as credential
      where credential.provider_id = reviewed_provider_id
        and credential.id <> reviewed_credential_id
        and credential.credential_type = 'insurance'
        and credential.review_status = 'approved'
        and char_length(trim(credential.issuer)) > 0
        and credential.expires_on is not null
        and credential.expires_on >= current_date
    )
  then
    update public.profiles
    set provider_status = 'pending'
    where id = reviewed_provider_id
      and provider_status = 'approved';

    if found then
      update public.provider_details
      set
        submitted_at = null,
        reviewed_at = null,
        reviewed_by = null
      where provider_id = reviewed_provider_id;
    end if;
  end if;
end;
$$;

revoke all on function public.review_provider_credential(uuid, text, text)
  from public;
grant execute on function public.review_provider_credential(uuid, text, text)
  to authenticated;

-- Preserve versioned legal-acceptance enforcement while adding the current
-- insurance requirement. A provider application cannot be submitted through a
-- direct API call unless the current all-user and provider agreements exist.
drop function if exists public.submit_provider_application();

create function public.submit_provider_application(
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
    select 1 from public.profiles
    where id = current_provider_id and role = 'provider'
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
    select 1 from public.provider_details
    where provider_id = current_provider_id
      and char_length(trim(headline)) >= 10
      and char_length(trim(bio)) >= 80
      and char_length(trim(service_area)) >= 2
  ) then
    raise exception 'Complete your introduction and service area before submitting.';
  end if;

  if not exists (
    select 1 from public.provider_services
    where provider_id = current_provider_id and is_active
  ) then
    raise exception 'Add at least one active service before submitting.';
  end if;

  if not exists (
    select 1 from public.provider_photos
    where provider_id = current_provider_id
  ) then
    raise exception 'Add at least one profile photo before submitting.';
  end if;

  if not exists (
    select 1 from public.provider_credentials
    where provider_id = current_provider_id
      and credential_type = 'insurance'
      and char_length(trim(issuer)) > 0
      and expires_on is not null
      and expires_on >= current_date
  ) then
    raise exception 'Add a current insurance credential with its carrier and unexpired expiration date before submitting.';
  end if;

  if not exists (
    select 1 from public.provider_availability
    where provider_id = current_provider_id and is_available
  ) then
    raise exception 'Add at least one available day before submitting.';
  end if;

  update public.provider_details
  set
    submitted_at = timezone('utc', now()),
    reviewed_at = null,
    reviewed_by = null,
    risk_controls_required_at = coalesce(
      risk_controls_required_at,
      timezone('utc', now())
    )
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
    select 1 from public.profiles
    where id = current_reviewer_id and role = 'admin'
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
    not exists (
      select 1 from public.provider_services
      where provider_id = reviewed_provider_id and is_active
    )
    or not exists (
      select 1 from public.provider_photos
      where provider_id = reviewed_provider_id
    )
    or not exists (
      select 1 from public.provider_credentials
      where provider_id = reviewed_provider_id
        and credential_type = 'insurance'
        and char_length(trim(issuer)) > 0
        and expires_on is not null
        and expires_on >= current_date
        and review_status = 'approved'
    )
    or not exists (
      select 1 from public.provider_availability
      where provider_id = reviewed_provider_id and is_available
    )
  ) then
    raise exception 'The provider application needs an approved current insurance credential and all required sections before approval.';
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
