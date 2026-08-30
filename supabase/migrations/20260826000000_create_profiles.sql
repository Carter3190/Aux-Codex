-- Auxilium authentication foundation.
-- Creates private profiles for customers, providers, and administrators.

create schema if not exists private;
revoke all on schema private from public;

create type public.user_role as enum ('customer', 'provider', 'admin');
create type public.provider_status as enum (
  'not_applicable',
  'pending',
  'approved',
  'rejected',
  'suspended'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  role public.user_role not null default 'customer',
  provider_status public.provider_status not null default 'not_applicable',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_provider_status_matches_role check (
    (role = 'provider' and provider_status <> 'not_applicable')
    or (role <> 'provider' and provider_status = 'not_applicable')
  )
);

comment on table public.profiles is
  'Private Auxilium account profile linked one-to-one with auth.users.';

create function private.handle_new_user()
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
    full_name,
    role,
    provider_status
  )
  values (
    new.id,
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function private.set_profile_updated_at();

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
