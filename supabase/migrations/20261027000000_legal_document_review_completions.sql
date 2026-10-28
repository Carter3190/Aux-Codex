-- Per-document review evidence for legal reacceptance.
-- Review rows are immutable and bind the user to the exact document key,
-- version, and published source hash that was current when they reviewed it.

create table if not exists public.legal_document_review_completions (
  id uuid primary key default gen_random_uuid(),
  -- Retained independently of profiles so account removal does not silently
  -- erase the historical review evidence.
  user_id uuid not null,
  user_email text not null,
  reviewed_role public.user_role not null,
  document_key text not null,
  document_version text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  document_title text not null,
  document_path text not null,
  affirmation text not null check (char_length(affirmation) between 10 and 500),
  completed_at timestamptz not null default timezone('utc', now()),
  foreign key (document_key, document_version)
    references public.legal_document_versions (document_key, document_version)
    on delete restrict
);

comment on table public.legal_document_review_completions is
  'Immutable evidence that an authenticated account reviewed one exact legal-document version and content hash.';

create unique index if not exists legal_document_review_completion_unique
  on public.legal_document_review_completions (
    user_id,
    document_key,
    document_version,
    content_sha256
  );

create index if not exists legal_document_review_completions_user_idx
  on public.legal_document_review_completions (
    user_id,
    document_key,
    document_version
  );

create or replace function private.prevent_legal_document_review_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Completed legal-document reviews are append-only.';
end;
$$;

drop trigger if exists prevent_legal_document_review_update_or_delete
  on public.legal_document_review_completions;
create trigger prevent_legal_document_review_update_or_delete
  before update or delete on public.legal_document_review_completions
  for each row execute function private.prevent_legal_document_review_mutation();

alter table public.legal_document_review_completions enable row level security;

revoke all on table public.legal_document_review_completions
  from anon, authenticated;
grant select on table public.legal_document_review_completions
  to authenticated;

revoke all on table public.legal_document_review_completions from service_role;
grant select, insert on table public.legal_document_review_completions
  to service_role;

drop policy if exists "Users can view their own completed legal reviews"
  on public.legal_document_review_completions;
create policy "Users can view their own completed legal reviews"
  on public.legal_document_review_completions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Remove the short-lived two-argument draft signature if it was installed in
-- a preview environment; leaving it would preserve an avoidable bypass.
drop function if exists public.complete_current_legal_document_review(text, text);

create or replace function public.complete_current_legal_document_review(
  reviewed_document_key text,
  reviewed_document_version text,
  reviewed_content_sha256 text,
  review_confirmation text
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
  current_document record;
begin
  if current_user_id is null then
    raise exception 'Sign in before completing a legal-document review.';
  end if;

  if review_confirmation <> 'accepted' then
    raise exception 'Confirm that you reviewed the entire document before continuing.';
  end if;

  select profile.email, profile.role
  into current_user_email, current_user_role
  from public.profiles as profile
  where profile.id = current_user_id;

  if current_user_role is null then
    raise exception 'Account profile not found.';
  end if;

  -- Prevent a newly published version from becoming current between the
  -- exact-version comparison and the completion insert.
  lock table public.legal_document_versions in share mode;

  select
    version.document_key,
    version.document_version,
    version.content_sha256,
    version.title,
    version.document_path,
    version.audience
  into current_document
  from public.legal_document_versions as version
  where version.document_key = reviewed_document_key
    and version.effective_at <= timezone('utc', now())
  order by version.effective_at desc, version.created_at desc
  limit 1;

  if current_document.document_key is null then
    raise exception 'This legal document is not current or does not exist.';
  end if;

  if current_document.document_version is distinct from reviewed_document_version
    or current_document.content_sha256 is distinct from reviewed_content_sha256
  then
    raise exception 'The legal document changed while you were reviewing it. Open the current version and review it again.';
  end if;

  if (
    current_document.document_key in ('terms', 'privacy')
    and current_document.audience <> 'all'
  ) or (
    current_document.document_key in ('provider_agreement', 'provider_standards')
    and (
      current_document.audience <> 'provider'
      or current_user_role <> 'provider'::public.user_role
    )
  ) then
    raise exception 'This legal document does not apply to your account.';
  end if;

  insert into public.legal_document_review_completions (
    user_id,
    user_email,
    reviewed_role,
    document_key,
    document_version,
    content_sha256,
    document_title,
    document_path,
    affirmation
  )
  values (
    current_user_id,
    current_user_email,
    current_user_role,
    current_document.document_key,
    current_document.document_version,
    current_document.content_sha256,
    current_document.title,
    current_document.document_path,
    case current_document.document_key
      when 'terms' then
        'I have read the Terms of Service and agree to follow them.'
      when 'privacy' then
        'I have read the Privacy Policy and agree to follow it.'
      when 'provider_agreement' then
        'I have read the Provider Agreement and agree to follow it.'
      when 'provider_standards' then
        'I have read the Provider Standards and agree to follow them.'
    end
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.complete_current_legal_document_review(text, text, text, text)
  from public;
grant execute on function public.complete_current_legal_document_review(text, text, text, text)
  to authenticated;

-- Final account acceptance is permitted only after every currently required
-- document has an exact key/version/hash review row. Accounts that already
-- accepted every current document remain accepted and return without change.
create or replace function public.accept_current_account_legal_agreements()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_user_role public.user_role;
  required_document_keys text[];
  document_keys_to_accept text[];
begin
  select profile.role
  into current_user_role
  from public.profiles as profile
  where profile.id = current_user_id;

  if current_user_role is null then
    raise exception 'Sign in before accepting legal agreements.';
  end if;

  required_document_keys := case
    when current_user_role = 'provider'::public.user_role then
      array[
        'terms',
        'privacy',
        'provider_agreement',
        'provider_standards'
      ]::text[]
    else array['terms', 'privacy']::text[]
  end;

  -- Keep the current-version set stable until this transaction ends.
  lock table public.legal_document_versions in share mode;

  if (
    with current_documents as (
      select distinct on (version.document_key)
        version.document_key,
        version.audience
      from public.legal_document_versions as version
      where version.document_key = any(required_document_keys)
        and version.effective_at <= timezone('utc', now())
      order by version.document_key, version.effective_at desc, version.created_at desc
    )
    select count(*)
    from current_documents as document
    where (
      document.document_key in ('terms', 'privacy')
      and document.audience = 'all'
    ) or (
      document.document_key in ('provider_agreement', 'provider_standards')
      and document.audience = 'provider'
    )
  ) <> cardinality(required_document_keys) then
    raise exception 'The current legal-document registry is incomplete. Please contact support.';
  end if;

  -- Preserve accounts that already accepted every current required document;
  -- they are not forced to manufacture review evidence after the fact.
  if not exists (
    with current_documents as (
      select distinct on (version.document_key)
        version.document_key,
        version.document_version,
        version.audience
      from public.legal_document_versions as version
      where version.document_key = any(required_document_keys)
        and version.effective_at <= timezone('utc', now())
      order by version.document_key, version.effective_at desc, version.created_at desc
    )
    select 1
    from current_documents as document
    where not exists (
        select 1
        from public.legal_acceptances as acceptance
        where acceptance.user_id = current_user_id
          and acceptance.document_key = document.document_key
          and acceptance.document_version = document.document_version
      )
  ) then
    return;
  end if;

  if exists (
    with current_documents as (
      select distinct on (version.document_key)
        version.document_key,
        version.document_version,
        version.content_sha256,
        version.audience
      from public.legal_document_versions as version
      where version.document_key = any(required_document_keys)
        and version.effective_at <= timezone('utc', now())
      order by version.document_key, version.effective_at desc, version.created_at desc
    )
    select 1
    from current_documents as document
    where not exists (
      select 1
      from public.legal_acceptances as acceptance
      where acceptance.user_id = current_user_id
        and acceptance.document_key = document.document_key
        and acceptance.document_version = document.document_version
    )
      and not exists (
        select 1
        from public.legal_document_review_completions as review
        where review.user_id = current_user_id
          and review.document_key = document.document_key
          and review.document_version = document.document_version
          and review.content_sha256 = document.content_sha256
      )
  ) then
    raise exception 'Review and confirm every current legal document before accepting the agreements.';
  end if;

  with current_documents as (
    select distinct on (version.document_key)
      version.document_key,
      version.document_version
    from public.legal_document_versions as version
    where version.document_key = any(required_document_keys)
      and version.effective_at <= timezone('utc', now())
    order by version.document_key, version.effective_at desc, version.created_at desc
  )
  select array_agg(document.document_key order by document.document_key)
  into document_keys_to_accept
  from current_documents as document
  where not exists (
    select 1
    from public.legal_acceptances as acceptance
    where acceptance.user_id = current_user_id
      and acceptance.document_key = document.document_key
      and acceptance.document_version = document.document_version
  );

  perform public.record_current_legal_acceptances(
    document_keys_to_accept,
    'account_reacceptance',
    null
  );
end;
$$;

revoke all on function public.accept_current_account_legal_agreements()
  from public;
grant execute on function public.accept_current_account_legal_agreements()
  to authenticated;
