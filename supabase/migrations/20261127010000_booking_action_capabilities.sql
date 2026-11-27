-- Read-only display capabilities for a provider's own bookings. Mutation RPCs
-- and credential/date checks remain authoritative and are not changed here.
begin;

create or replace function public.get_provider_booking_action_capabilities(
  requested_booking_ids uuid[]
)
returns table (
  booking_id uuid,
  can_accept boolean,
  accept_unavailable_reason text,
  can_set_price boolean,
  price_unavailable_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_provider_id uuid := (select auth.uid());
begin
  if current_provider_id is null or not exists (
    select 1 from public.profiles as profile
    where profile.id = current_provider_id and profile.role = 'provider'
  ) then
    raise exception 'Only provider accounts can view booking actions.';
  end if;
  if coalesce(cardinality(requested_booking_ids), 0) > 500 then
    raise exception 'Request booking actions for no more than 500 bookings at a time.';
  end if;

  return query
  with owned as (
    select booking.*, profile.provider_status,
      exists (
        select 1 from public.provider_services as service
        where service.id = booking.service_id
          and service.provider_id = booking.provider_id
          and service.is_active
      ) and exists (
        select 1 from public.provider_details as details
        where details.provider_id = booking.provider_id
      ) and coalesce(private.service_credential_review_is_eligible(
        booking.service_id, greatest(current_date, booking.requested_date)
      ), false) as service_eligible,
      exists (
        select 1 from public.booking_requests as other_booking
        where other_booking.provider_id = booking.provider_id
          and other_booking.requested_date = booking.requested_date
          and other_booking.requested_start_time = booking.requested_start_time
          and other_booking.status = 'accepted'
          and other_booking.id <> booking.id
      ) as slot_taken,
      exists (
        select 1 from public.booking_payments as payment
        where payment.booking_id = booking.id
          and payment.status not in ('failed', 'expired')
      ) as price_locked
    from public.booking_requests as booking
    join public.profiles as profile on profile.id = booking.provider_id
    where booking.provider_id = current_provider_id
      and booking.id = any(coalesce(requested_booking_ids, '{}'::uuid[]))
  ), reasons as (
    select owned.id,
      case
        when owned.status <> 'pending' then 'request_closed'
        when owned.provider_status <> 'approved' then 'approval_required'
        when not owned.service_eligible then 'service_review_required'
        when owned.slot_taken then 'slot_unavailable'
        else null
      end as accept_reason,
      case
        when owned.status not in ('accepted', 'completed') then 'price_unavailable'
        when owned.provider_status <> 'approved' then 'approval_required'
        when owned.price_locked then 'checkout_started'
        else null
      end as price_reason
    from owned
  )
  select reasons.id, reasons.accept_reason is null, reasons.accept_reason,
    reasons.price_reason is null, reasons.price_reason
  from reasons;
end;
$$;

revoke all on function public.get_provider_booking_action_capabilities(uuid[]) from public, anon;
grant execute on function public.get_provider_booking_action_capabilities(uuid[]) to authenticated;

commit;
