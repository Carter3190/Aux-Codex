-- Keep ordinary scheduling changes separate from reviewed application content.
-- No existing approval, credential decision, booking or payment row is rewritten.
begin;

drop trigger if exists mark_provider_availability_changed on public.provider_availability;

-- A no-op save must not change the review timestamp/snapshot.
create or replace function private.set_provider_updated_at_if_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    new.updated_at := timezone('utc', now());
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

-- Keep these timestamps stable when a provider saves the same content.
drop trigger if exists set_provider_details_updated_at on public.provider_details;
create trigger set_provider_details_updated_at before update on public.provider_details
  for each row execute function private.set_provider_updated_at_if_changed();
drop trigger if exists set_provider_services_updated_at on public.provider_services;
create trigger set_provider_services_updated_at before update on public.provider_services
  for each row execute function private.set_provider_updated_at_if_changed();
drop trigger if exists set_provider_availability_updated_at on public.provider_availability;
create trigger set_provider_availability_updated_at before update on public.provider_availability
  for each row execute function private.set_provider_updated_at_if_changed();
drop trigger if exists set_provider_credentials_updated_at on public.provider_credentials;
create trigger set_provider_credentials_updated_at before update on public.provider_credentials
  for each row execute function private.set_provider_updated_at_if_changed();

create or replace function private.reset_provider_details_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if row(new.business_name, new.headline, new.bio, new.years_experience,
         new.service_area, new.travel_radius_miles)
    is not distinct from
     row(old.business_name, old.headline, old.bio, old.years_experience,
         old.service_area, old.travel_radius_miles) then
    return new;
  end if;
  new.submitted_at := null;
  new.reviewed_at := null;
  new.reviewed_by := null;
  update public.profiles set provider_status = 'pending'
    where id = new.provider_id and provider_status in ('approved', 'rejected');
  return new;
end;
$$;

create or replace function private.mark_provider_content_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_provider_id uuid;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
      return new;
    end if;
    -- Archiving removes a service from new requests; it must not unlist the
    -- provider's other reviewed services. Reactivation still needs review.
    if tg_table_name = 'provider_services' then
      -- Private edits to an archived draft cannot create booking eligibility.
      if not old.is_active and not new.is_active then
        return new;
      end if;
      if old.is_active and not new.is_active
        and row(new.name, new.description, new.pricing_type, new.price_cents)
          is not distinct from row(old.name, old.description, old.pricing_type, old.price_cents) then
        return new;
      end if;
    end if;
  end if;
  changed_provider_id := case when tg_op = 'DELETE' then old.provider_id else new.provider_id end;
  update public.provider_details
    set submitted_at = null, reviewed_at = null, reviewed_by = null
    where provider_id = changed_provider_id;
  update public.profiles set provider_status = 'pending'
    where id = changed_provider_id and provider_status in ('approved', 'rejected');
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Edits to evidence always require a fresh individual review, while a no-op
-- correction preserves the existing decision and service attestation.
create or replace function private.reset_provider_credential_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(new.credential_type, new.title, new.issuer, new.credential_number,
         new.expires_on, new.document_path)
    is not distinct from
     row(old.credential_type, old.title, old.issuer, old.credential_number,
         old.expires_on, old.document_path) then
    return new;
  end if;
  new.review_status := 'pending';
  new.review_notes := '';
  new.reviewed_at := null;
  new.reviewed_by := null;
  return new;
end;
$$;

create or replace function private.require_provider_credential_issuer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.credential_type in ('license', 'insurance') and char_length(trim(new.issuer)) = 0 then
    raise exception 'License and insurance credentials need the issuing organization or carrier.';
  end if;
  return new;
end;
$$;

drop trigger if exists require_provider_credential_issuer on public.provider_credentials;
create trigger require_provider_credential_issuer
  before insert or update of credential_type, title, issuer, credential_number, expires_on, document_path
  on public.provider_credentials
  for each row execute function private.require_provider_credential_issuer();

revoke all on function private.set_provider_updated_at_if_changed(),
  private.require_provider_credential_issuer() from public, anon, authenticated;

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
    and reviewed_credential_type = 'license'
    and char_length(trim(coalesce(reviewed_issuer, ''))) = 0
  then
    raise exception 'A license credential needs its issuing organization before approval.';
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

commit;
