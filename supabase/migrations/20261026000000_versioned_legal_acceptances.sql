-- Versioned, append-only legal acceptance records.
-- Existing accounts are intentionally not backfilled: they must affirm the
-- current documents so the timestamp represents a real user action.

create table if not exists public.legal_document_versions (
  document_key text not null check (
    document_key in (
      'terms',
      'privacy',
      'provider_agreement',
      'provider_standards'
    )
  ),
  document_version text not null check (char_length(document_version) between 1 and 40),
  title text not null check (char_length(title) between 2 and 100),
  document_path text not null check (document_path ~ '^/[a-z0-9/-]+$'),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  audience text not null check (audience in ('all', 'provider')),
  effective_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (document_key, document_version)
);

comment on table public.legal_document_versions is
  'Append-only registry of published Auxilium legal-document versions.';
comment on column public.legal_document_versions.content_sha256 is
  'SHA-256 digest of the version-controlled legal page source published for this version.';

insert into public.legal_document_versions (
  document_key,
  document_version,
  title,
  document_path,
  content_sha256,
  audience,
  effective_at
)
values
  (
    'terms',
    '2026-10-26',
    'Terms of Service',
    '/terms',
    'a7904e2f46dbd1c9693c3cfc9ed09b0e71dadd1afc682547867b36b7f4b17704',
    'all',
    '2026-10-26 00:00:00+00'
  ),
  (
    'privacy',
    '2026-10-26',
    'Privacy Policy',
    '/privacy',
    '4160b3c8f0d534bbfbfd95c96c4927a19fe3ac2de250a88e767a8da176b7f315',
    'all',
    '2026-10-26 00:00:00+00'
  ),
  (
    'provider_agreement',
    '2026-10-26',
    'Provider Agreement',
    '/provider-agreement',
    '620bf2977a732825d092d7e8b4f8dcac53b64c20b759410d54610e46b07148c5',
    'provider',
    '2026-10-26 00:00:00+00'
  ),
  (
    'provider_standards',
    '2026-10-26',
    'Provider Standards',
    '/provider-standards',
    'e3bf02d14e8c34b7ac9bd330e55fb215da41c4295de17700232e1607c6ce8ed4',
    'provider',
    '2026-10-26 00:00:00+00'
  )
on conflict (document_key, document_version) do nothing;

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately retained independently of profiles so removing an account
  -- does not silently erase the historical acceptance evidence.
  user_id uuid not null,
  user_email text not null,
  accepted_role public.user_role not null,
  document_key text not null,
  document_version text not null,
  document_title text not null,
  document_path text not null,
  acceptance_source text not null check (
    acceptance_source in (
      'signup',
      'account_reacceptance',
      'provider_application',
      'booking_request'
    )
  ),
  acceptance_context_id uuid,
  affirmation text not null check (char_length(affirmation) between 10 and 500),
  accepted_at timestamptz not null default timezone('utc', now()),
  foreign key (document_key, document_version)
    references public.legal_document_versions (document_key, document_version)
    on delete restrict
);

comment on table public.legal_acceptances is
  'Immutable evidence that an authenticated account affirmatively accepted a specific legal-document version.';

create unique index if not exists legal_acceptances_idempotency_idx
  on public.legal_acceptances (
    user_id,
    document_key,
    document_version,
    acceptance_source,
    coalesce(acceptance_context_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists legal_acceptances_user_document_idx
  on public.legal_acceptances (user_id, document_key, document_version);

create index if not exists legal_acceptances_context_idx
  on public.legal_acceptances (acceptance_context_id)
  where acceptance_context_id is not null;

create or replace function private.prevent_legal_document_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Published legal-document versions are append-only.';
end;
$$;

drop trigger if exists prevent_legal_document_version_update_or_delete
  on public.legal_document_versions;
create trigger prevent_legal_document_version_update_or_delete
  before update or delete on public.legal_document_versions
  for each row execute function private.prevent_legal_document_version_mutation();

create or replace function private.prevent_legal_acceptance_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Legal acceptance records are append-only.';
end;
$$;

drop trigger if exists prevent_legal_acceptance_update_or_delete
  on public.legal_acceptances;
create trigger prevent_legal_acceptance_update_or_delete
  before update or delete on public.legal_acceptances
  for each row execute function private.prevent_legal_acceptance_mutation();

alter table public.legal_document_versions enable row level security;
alter table public.legal_acceptances enable row level security;

revoke all on table public.legal_document_versions from anon, authenticated;
grant select on table public.legal_document_versions to anon, authenticated;

revoke all on table public.legal_acceptances from anon, authenticated;
grant select on table public.legal_acceptances to authenticated;

revoke all on table public.legal_document_versions from service_role;
grant select, insert on table public.legal_document_versions to service_role;
revoke all on table public.legal_acceptances from service_role;
grant select, insert on table public.legal_acceptances to service_role;

drop policy if exists "Published legal versions are readable"
  on public.legal_document_versions;
create policy "Published legal versions are readable"
  on public.legal_document_versions
  for select
  to anon, authenticated
  using (effective_at <= timezone('utc', now()));

drop policy if exists "Users can view their own legal acceptances"
  on public.legal_acceptances;
create policy "Users can view their own legal acceptances"
  on public.legal_acceptances
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

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
        'I understand that the identified provider, not Auxilium, performs the service and, if the provider accepts, any resulting service agreement is directly with that provider.'
      else
        'I have reviewed each current Auxilium legal document and agree to or acknowledge it, as applicable.'
    end
  from current_documents as document
  where document.document_key = any(document_keys)
  on conflict do nothing;
end;
$$;

revoke all on function public.record_current_legal_acceptances(text[], text, uuid)
  from public;

create or replace function public.accept_current_account_legal_agreements()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_role public.user_role;
  required_document_keys text[];
begin
  select profile.role
  into current_user_role
  from public.profiles as profile
  where profile.id = (select auth.uid());

  if current_user_role is null then
    raise exception 'Sign in before accepting legal agreements.';
  end if;

  with current_documents as (
    select distinct on (version.document_key)
      version.document_key,
      version.audience
    from public.legal_document_versions as version
    where version.effective_at <= timezone('utc', now())
    order by version.document_key, version.effective_at desc, version.created_at desc
  )
  select array_agg(document.document_key order by document.document_key)
  into required_document_keys
  from current_documents as document
  where document.audience = 'all'
    or current_user_role = 'provider'::public.user_role;

  perform public.record_current_legal_acceptances(
    required_document_keys,
    'account_reacceptance',
    null
  );
end;
$$;

revoke all on function public.accept_current_account_legal_agreements()
  from public;
grant execute on function public.accept_current_account_legal_agreements()
  to authenticated;

-- Create the account profile only. Legal records are deliberately not created
-- from auth metadata because that metadata can be supplied through the public
-- Auth API. A new user records a server-timestamped acceptance after signing in.
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
      'Auxilium member'
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

-- Submission remains database-enforced even if a client bypasses the form.
create or replace function public.submit_provider_application()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_provider_id uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.profiles
    where id = current_provider_id and role = 'provider'
  ) then
    raise exception 'Only providers can submit an application.';
  end if;

  if exists (
    with current_provider_documents as (
      select distinct on (version.document_key)
        version.document_key,
        version.document_version
      from public.legal_document_versions as version
      where version.audience = 'provider'
        and version.effective_at <= timezone('utc', now())
      order by version.document_key, version.effective_at desc, version.created_at desc
    )
    select 1
    from current_provider_documents as document
    where not exists (
      select 1
      from public.legal_acceptances as acceptance
      where acceptance.user_id = current_provider_id
        and acceptance.document_key = document.document_key
        and acceptance.document_version = document.document_version
        and acceptance.acceptance_source = 'provider_application'
    )
  ) then
    raise exception 'Review and accept the current Provider Agreement and Provider Standards before submitting.';
  end if;

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
  ) then
    raise exception 'Add at least one credential before submitting.';
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
    reviewed_by = null
  where provider_id = current_provider_id;

  update public.profiles
  set provider_status = 'pending'
  where id = current_provider_id;
end;
$$;

revoke all on function public.submit_provider_application() from public;
grant execute on function public.submit_provider_application() to authenticated;
