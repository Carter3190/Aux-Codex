-- Correct the displayed brand spelling to Auxillium. This is a spelling-only
-- publication: obligations, responsibility, fees, and payment behavior do not change.
-- Existing versions, reviews, acceptances, profiles, and booking records remain
-- untouched. Coordinate activation with the matching app release: these versions
-- become effective when this transaction commits and require the normal review gate.
begin;

insert into public.legal_document_versions (
  document_key, document_version, title, document_path, content_sha256,
  audience, effective_at
)
values
  ('terms', '2026-11-17', 'Terms of Service', '/terms',
   '90bc557b7029fc77e2ae557b1bd9ec9129f9a446a04611bf20e39cbdd29b73a1', 'all', now()),
  ('privacy', '2026-11-17', 'Privacy Policy', '/privacy',
   'e262608a2bdb9b05fd0b7a4204ca5744f6a87210f5c9a4f5245b5c7a7d94c6ad', 'all', now()),
  ('provider_agreement', '2026-11-17', 'Provider Agreement', '/provider-agreement',
   'fec986089651051ff6edfde16ca40db565ed349c41e86183abff663f3b5b35b6', 'provider', now()),
  ('provider_standards', '2026-11-17', 'Provider Standards', '/provider-standards',
   '45912387405914b5b5467be927b945224dde1654566802a82857cdd70c7f76ed', 'provider', now())
on conflict (document_key, document_version) do nothing;

-- Future acceptance evidence uses exactly the spelling displayed in the app.
create or replace function public.record_current_legal_acceptances(
  document_keys text[],
  acceptance_source text,
  acceptance_context_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_user_email text;
  current_user_role public.user_role;
  requested_document_count integer;
  matched_document_count integer;
begin
  if current_user_id is null then
    raise exception 'Sign in before accepting legal agreements.';
  end if;

  if acceptance_source not in (
    'account_reacceptance',
    'provider_application',
    'booking_request'
  ) then
    raise exception 'Invalid legal acceptance source.';
  end if;

  if coalesce(array_length(document_keys, 1), 0) = 0 then
    raise exception 'Choose at least one legal document.';
  end if;

  if acceptance_source = 'booking_request' and acceptance_context_id is null then
    raise exception 'A booking acceptance must identify its booking.';
  end if;

  if acceptance_source <> 'booking_request' and acceptance_context_id is not null then
    raise exception 'This acceptance source does not use a booking context.';
  end if;

  select profile.email, profile.role
  into current_user_email, current_user_role
  from public.profiles as profile
  where profile.id = current_user_id;

  if current_user_role is null then
    raise exception 'Account profile not found.';
  end if;

  if acceptance_source = 'provider_application'
    and current_user_role <> 'provider'::public.user_role then
    raise exception 'Only providers can accept application agreements.';
  end if;

  if acceptance_source = 'booking_request' and not exists (
    select 1
    from public.booking_requests as booking
    where booking.id = acceptance_context_id
      and booking.customer_id = current_user_id
  ) then
    raise exception 'Booking not found for this customer.';
  end if;

  select count(*)
  into requested_document_count
  from (
    select distinct unnest(document_keys) as document_key
  ) as requested;

  with current_documents as (
    select distinct on (version.document_key)
      version.document_key,
      version.document_version,
      version.title,
      version.document_path,
      version.audience
    from public.legal_document_versions as version
    where version.effective_at <= timezone('utc', now())
    order by version.document_key, version.effective_at desc, version.created_at desc
  )
  select count(*)
  into matched_document_count
  from current_documents as document
  where document.document_key = any(document_keys)
    and (
      document.audience = 'all'
      or current_user_role = 'provider'::public.user_role
    );

  if requested_document_count <> matched_document_count then
    raise exception 'One or more legal documents are invalid for this account.';
  end if;

  with current_documents as (
    select distinct on (version.document_key)
      version.document_key,
      version.document_version,
      version.title,
      version.document_path,
      version.audience
    from public.legal_document_versions as version
    where version.effective_at <= timezone('utc', now())
    order by version.document_key, version.effective_at desc, version.created_at desc
  )
  insert into public.legal_acceptances (
    user_id,
    user_email,
    accepted_role,
    document_key,
    document_version,
    document_title,
    document_path,
    acceptance_source,
    acceptance_context_id,
    affirmation
  )
  select
    current_user_id,
    current_user_email,
    current_user_role,
    document.document_key,
    document.document_version,
    document.title,
    document.document_path,
    acceptance_source,
    acceptance_context_id,
    case acceptance_source
      when 'provider_application' then
        'I agree to the current Provider Agreement and Provider Standards, accept responsibility for my services and personnel, and confirm that required licenses, credentials, and insurance are current.'
      when 'booking_request' then
        format('I understand that %s, not Auxillium, will perform and be responsible for the requested service. If the provider accepts, any resulting service agreement will be directly with that provider. I agree to Auxillium’s current Terms of Service.', (select booking.provider_name from public.booking_requests as booking where booking.id = acceptance_context_id and booking.customer_id = current_user_id))
      else
        'I have reviewed each current Auxillium legal document and agree to or acknowledge it, as applicable.'
    end
  from current_documents as document
  where document.document_key = any(document_keys)
  on conflict do nothing;
end;
$$;

revoke all on function public.record_current_legal_acceptances(text[], text, uuid)
  from public;

-- Only future accounts with no supplied name use this fallback. Existing names
-- and all profile, role, and provider-creation behavior are preserved.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.user_role;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'requested_role' = 'provider'
      then 'provider'::public.user_role
    else 'customer'::public.user_role
  end;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    provider_status
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      'Auxillium member'
    ),
    requested_role,
    case
      when requested_role = 'provider'
        then 'pending'::public.provider_status
      else 'not_applicable'::public.provider_status
    end
  );

  if requested_role = 'provider' then
    insert into public.provider_details (provider_id)
    values (new.id);
  end if;

  return new;
end;
$$;

-- Preserve the same restricted-service check and trigger; correct its message.
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
    raise exception 'Restricted service: healthcare, chiropractic, medical, clinical, patient-care, and emergency-response services cannot be listed on Auxillium.';
  end if;

  return new;
end;
$$;

commit;
