-- Publish payment-after-service terms and preserve old acceptance records.
-- Deploy matching page source and apply in the coordinated rollout described in
-- DEPLOYMENT.md. Existing versions/reviews/acceptances remain append-only.
begin;

insert into public.legal_document_versions (
  document_key, document_version, title, document_path, content_sha256,
  audience, effective_at
)
values
  ('terms', '2026-11-11', 'Terms of Service', '/terms',
   'eacb5d95206592d820ec5ac1a429dc29383b0f998b3c4dc119ddc4f4f081eb33', 'all', now()),
  ('provider_agreement', '2026-11-11', 'Provider Agreement', '/provider-agreement',
   '4083862feef2cb092614165d63ea4bcd509d0db890b02536a4c6f6103869d879', 'provider', now())
on conflict (document_key, document_version) do nothing;

-- Future booking affirmations match the displayed acknowledgement, including the
-- immutable provider name snapshot. No earlier acceptance is rewritten.
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
        format('I understand that %s, not Auxilium, will perform and be responsible for the requested service. If the provider accepts, any resulting service agreement will be directly with that provider. I agree to Auxilium’s current Terms of Service.', (select booking.provider_name from public.booking_requests as booking where booking.id = acceptance_context_id and booking.customer_id = current_user_id))
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


commit;
