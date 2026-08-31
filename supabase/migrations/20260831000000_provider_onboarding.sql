-- Auxilium provider onboarding and review workflow.
-- Adds structured provider data, private credential storage, public profile
-- photos, completion checks, and audited admin approval decisions.

alter table public.profiles
  add column if not exists email text;

update public.profiles as profile
set email = auth_user.email
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.email is null;

alter table public.profiles
  alter column email set not null;

create unique index if not exists profiles_email_lower_unique
  on public.profiles (lower(email));

create table if not exists public.provider_details (
  provider_id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null default '' check (char_length(business_name) <= 100),
  headline text not null default '' check (char_length(headline) <= 120),
  bio text not null default '' check (char_length(bio) <= 2000),
  years_experience integer check (years_experience between 0 and 80),
  service_area text not null default '' check (char_length(service_area) <= 160),
  travel_radius_miles integer check (travel_radius_miles between 0 and 250),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  pricing_type text not null check (
    pricing_type in ('hourly', 'fixed', 'starting_at', 'quote')
  ),
  price_cents integer,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint provider_services_price_matches_type check (
    (pricing_type = 'quote' and price_cents is null)
    or
    (pricing_type <> 'quote' and price_cents between 100 and 100000000)
  ),
  unique (provider_id, name)
);

create table if not exists public.provider_availability (
  provider_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_available boolean not null default false,
  start_time time,
  end_time time,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (provider_id, weekday),
  constraint provider_availability_times_are_valid check (
    (not is_available and start_time is null and end_time is null)
    or
    (is_available and start_time is not null and end_time is not null and end_time > start_time)
  )
);

create table if not exists public.provider_photos (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 3 and 500),
  caption text not null default '' check (char_length(caption) <= 160),
  sort_order smallint not null default 0 check (sort_order between 0 and 20),
  created_at timestamptz not null default timezone('utc', now()),
  unique (provider_id, storage_path)
);

create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  credential_type text not null check (
    credential_type in (
      'license',
      'insurance',
      'certification',
      'identity',
      'background_check',
      'other'
    )
  ),
  title text not null check (char_length(title) between 2 and 120),
  issuer text not null default '' check (char_length(issuer) <= 120),
  credential_number text not null default '' check (char_length(credential_number) <= 120),
  expires_on date,
  document_path text not null check (char_length(document_path) between 3 and 500),
  review_status text not null default 'pending' check (
    review_status in ('pending', 'approved', 'rejected')
  ),
  review_notes text not null default '' check (char_length(review_notes) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (provider_id, document_path)
);

create table if not exists public.provider_review_events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  decision public.provider_status not null check (decision in ('approved', 'rejected')),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.provider_details is
  'Provider-owned marketplace profile and application submission state.';
comment on table public.provider_credentials is
  'Private provider credential metadata; files live in the provider-credentials bucket.';
comment on table public.provider_review_events is
  'Immutable audit history for provider approval and rejection decisions.';

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function private.reset_provider_details_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.submitted_at := null;
  new.reviewed_at := null;
  new.reviewed_by := null;

  update public.profiles
  set provider_status = 'pending'
  where id = new.provider_id
    and provider_status in ('approved', 'rejected');

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
  changed_provider_id := case
    when tg_op = 'DELETE' then old.provider_id
    else new.provider_id
  end;

  update public.provider_details
  set
    submitted_at = null,
    reviewed_at = null,
    reviewed_by = null
  where provider_id = changed_provider_id;

  update public.profiles
  set provider_status = 'pending'
  where id = changed_provider_id
    and provider_status in ('approved', 'rejected');

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists set_provider_details_updated_at on public.provider_details;
create trigger set_provider_details_updated_at
  before update on public.provider_details
  for each row execute function private.set_updated_at();

drop trigger if exists reset_provider_details_review on public.provider_details;
create trigger reset_provider_details_review
  before update of business_name, headline, bio, years_experience,
    service_area, travel_radius_miles
  on public.provider_details
  for each row execute function private.reset_provider_details_review();

drop trigger if exists set_provider_services_updated_at on public.provider_services;
create trigger set_provider_services_updated_at
  before update on public.provider_services
  for each row execute function private.set_updated_at();

drop trigger if exists mark_provider_services_changed on public.provider_services;
create trigger mark_provider_services_changed
  after insert or update or delete on public.provider_services
  for each row execute function private.mark_provider_content_changed();

drop trigger if exists set_provider_availability_updated_at on public.provider_availability;
create trigger set_provider_availability_updated_at
  before update on public.provider_availability
  for each row execute function private.set_updated_at();

drop trigger if exists mark_provider_availability_changed on public.provider_availability;
create trigger mark_provider_availability_changed
  after insert or update or delete on public.provider_availability
  for each row execute function private.mark_provider_content_changed();

drop trigger if exists mark_provider_photos_changed on public.provider_photos;
create trigger mark_provider_photos_changed
  after insert or update or delete on public.provider_photos
  for each row execute function private.mark_provider_content_changed();

drop trigger if exists set_provider_credentials_updated_at on public.provider_credentials;
create trigger set_provider_credentials_updated_at
  before update on public.provider_credentials
  for each row execute function private.set_updated_at();

drop trigger if exists mark_provider_credentials_changed on public.provider_credentials;
create trigger mark_provider_credentials_changed
  after insert or delete or update of credential_type, title, issuer,
    credential_number, expires_on, document_path
  on public.provider_credentials
  for each row execute function private.mark_provider_content_changed();

insert into public.provider_details (provider_id)
select id
from public.profiles
where role = 'provider'
on conflict (provider_id) do nothing;

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

create or replace function private.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_updated();

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

  if review_decision not in ('approved', 'rejected') then
    raise exception 'Choose an approved or rejected decision.';
  end if;

  if review_decision = 'rejected' and char_length(trim(review_notes)) < 10 then
    raise exception 'Add clear review notes when rejecting an application.';
  end if;

  if not exists (
    select 1
    from public.provider_details
    where provider_id = reviewed_provider_id
      and submitted_at is not null
  ) then
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
    )
    or not exists (
      select 1 from public.provider_availability
      where provider_id = reviewed_provider_id and is_available
    )
  ) then
    raise exception 'The provider application is no longer complete.';
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
    trim(review_notes)
  );
end;
$$;

revoke all on function public.review_provider_application(uuid, text, text) from public;
grant execute on function public.review_provider_application(uuid, text, text) to authenticated;

alter table public.provider_details enable row level security;
alter table public.provider_services enable row level security;
alter table public.provider_availability enable row level security;
alter table public.provider_photos enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.provider_review_events enable row level security;

revoke all on table public.provider_details from anon, authenticated;
revoke all on table public.provider_services from anon, authenticated;
revoke all on table public.provider_availability from anon, authenticated;
revoke all on table public.provider_photos from anon, authenticated;
revoke all on table public.provider_credentials from anon, authenticated;
revoke all on table public.provider_review_events from anon, authenticated;

grant select on table public.provider_details to authenticated;
grant update (
  business_name,
  headline,
  bio,
  years_experience,
  service_area,
  travel_radius_miles
) on table public.provider_details to authenticated;

grant select on table public.provider_services to authenticated;
grant insert (provider_id, name, description, pricing_type, price_cents, is_active)
  on table public.provider_services to authenticated;
grant update (name, description, pricing_type, price_cents, is_active)
  on table public.provider_services to authenticated;
grant delete on table public.provider_services to authenticated;

grant select on table public.provider_availability to authenticated;
grant insert (provider_id, weekday, is_available, start_time, end_time)
  on table public.provider_availability to authenticated;
-- PostgREST upserts include the conflict-key columns in the update statement.
-- RLS still prevents a provider_id from ever being changed to another user.
grant update (provider_id, weekday, is_available, start_time, end_time)
  on table public.provider_availability to authenticated;
grant delete on table public.provider_availability to authenticated;

grant select on table public.provider_photos to authenticated;
grant insert (provider_id, storage_path, caption, sort_order)
  on table public.provider_photos to authenticated;
grant update (caption, sort_order) on table public.provider_photos to authenticated;
grant delete on table public.provider_photos to authenticated;

grant select on table public.provider_credentials to authenticated;
grant insert (
  provider_id,
  credential_type,
  title,
  issuer,
  credential_number,
  expires_on,
  document_path
) on table public.provider_credentials to authenticated;
grant update (
  credential_type,
  title,
  issuer,
  credential_number,
  expires_on,
  document_path
) on table public.provider_credentials to authenticated;
grant delete on table public.provider_credentials to authenticated;

grant select on table public.provider_review_events to authenticated;

grant all on table public.provider_details to service_role;
grant all on table public.provider_services to service_role;
grant all on table public.provider_availability to service_role;
grant all on table public.provider_photos to service_role;
grant all on table public.provider_credentials to service_role;
grant all on table public.provider_review_events to service_role;

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles
  for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "Providers can view their own details" on public.provider_details;
create policy "Providers can view their own details"
  on public.provider_details
  for select
  to authenticated
  using ((select auth.uid()) = provider_id);

drop policy if exists "Providers can update their own details" on public.provider_details;
create policy "Providers can update their own details"
  on public.provider_details
  for update
  to authenticated
  using ((select auth.uid()) = provider_id)
  with check ((select auth.uid()) = provider_id);

drop policy if exists "Admins can view provider details" on public.provider_details;
create policy "Admins can view provider details"
  on public.provider_details
  for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "Providers manage their own services" on public.provider_services;
create policy "Providers manage their own services"
  on public.provider_services
  for all
  to authenticated
  using ((select auth.uid()) = provider_id)
  with check ((select auth.uid()) = provider_id);

drop policy if exists "Admins can view provider services" on public.provider_services;
create policy "Admins can view provider services"
  on public.provider_services
  for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "Providers manage their own availability" on public.provider_availability;
create policy "Providers manage their own availability"
  on public.provider_availability
  for all
  to authenticated
  using ((select auth.uid()) = provider_id)
  with check ((select auth.uid()) = provider_id);

drop policy if exists "Admins can view provider availability" on public.provider_availability;
create policy "Admins can view provider availability"
  on public.provider_availability
  for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "Providers manage their own photos" on public.provider_photos;
create policy "Providers manage their own photos"
  on public.provider_photos
  for all
  to authenticated
  using ((select auth.uid()) = provider_id)
  with check ((select auth.uid()) = provider_id);

drop policy if exists "Admins can view provider photos" on public.provider_photos;
create policy "Admins can view provider photos"
  on public.provider_photos
  for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "Providers manage their own credentials" on public.provider_credentials;
create policy "Providers manage their own credentials"
  on public.provider_credentials
  for all
  to authenticated
  using ((select auth.uid()) = provider_id)
  with check ((select auth.uid()) = provider_id);

drop policy if exists "Admins can view provider credentials" on public.provider_credentials;
create policy "Admins can view provider credentials"
  on public.provider_credentials
  for select
  to authenticated
  using ((select private.is_admin()));

drop policy if exists "Providers can view their own review history" on public.provider_review_events;
create policy "Providers can view their own review history"
  on public.provider_review_events
  for select
  to authenticated
  using ((select auth.uid()) = provider_id);

drop policy if exists "Admins can view provider review history" on public.provider_review_events;
create policy "Admins can view provider review history"
  on public.provider_review_events
  for select
  to authenticated
  using ((select private.is_admin()));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'provider-photos',
    'provider-photos',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'provider-credentials',
    'provider-credentials',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public provider photos are readable" on storage.objects;
create policy "Public provider photos are readable"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'provider-photos');

drop policy if exists "Providers upload their own photos" on storage.objects;
create policy "Providers upload their own photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'provider'
    )
  );

drop policy if exists "Providers delete their own photos" on storage.objects;
create policy "Providers delete their own photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Providers view their own credential files" on storage.objects;
create policy "Providers view their own credential files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'provider-credentials'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  );

drop policy if exists "Providers upload their own credential files" on storage.objects;
create policy "Providers upload their own credential files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'provider-credentials'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'provider'
    )
  );

drop policy if exists "Providers delete their own credential files" on storage.objects;
create policy "Providers delete their own credential files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'provider-credentials'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
