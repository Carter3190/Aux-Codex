-- Preserve existing approved providers during rollout while marking every
-- future or resubmitted application for continuous insurance enforcement.

alter table public.provider_details
  add column if not exists risk_controls_required_at timestamptz;

comment on column public.provider_details.risk_controls_required_at is
  'When set, this provider must have an approved, current insurance credential at booking time.';

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
    join public.provider_details as details
      on details.provider_id = profile.id
    where profile.id = requested_provider_id
      and profile.role = 'provider'
      and profile.provider_status = 'approved'
      and (
        details.risk_controls_required_at is null
        or exists (
          select 1
          from public.provider_credentials as credential
          where credential.provider_id = requested_provider_id
            and credential.credential_type = 'insurance'
            and credential.review_status = 'approved'
            and char_length(trim(credential.issuer)) > 0
            and credential.expires_on is not null
            and credential.expires_on >= current_date
        )
      )
  );
$$;

revoke all on function public.is_provider_booking_eligible(uuid) from public;
grant execute on function public.is_provider_booking_eligible(uuid)
  to anon, authenticated;
