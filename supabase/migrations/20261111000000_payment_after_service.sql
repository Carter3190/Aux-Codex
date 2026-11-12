-- Payment is due only after the provider records that the work is finished.
-- This migration does not charge customers, create payouts, or alter paid /
-- processing / refunded payments. The provider remains the direct-charge merchant.
--
-- Run supabase/maintenance/post_service_payment_preflight.sql first. Reconcile
-- every existing pending attempt directly with Stripe, including past expiry.
-- Local expiry alone cannot rule out a completed payment with a delayed webhook.
-- Apply this migration before enabling the corresponding application release.

begin;
set local lock_timeout = '5s';

-- Serialize with booking/payment preparation and price changes. A lock timeout
-- rolls back the migration: retry rather than partially installing the new flow.
lock table public.booking_requests, public.booking_payments in access exclusive mode;

do $$
begin
  if exists (
    select 1 from public.booking_payments
    where status = 'checkout_pending'
  ) then
    raise exception 'Payment flow migration blocked: reconcile all existing Checkout attempts with Stripe before retrying.';
  end if;
end;
$$;

-- Defend against an old RPC invocation already in flight during deployment.
-- Even if that invocation resumes with its previous function body, it cannot
-- insert or reopen a payable Checkout for unfinished work after this commits.
create or replace function private.require_finished_work_for_checkout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_status text;
begin
  if new.status <> 'checkout_pending' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'checkout_pending'
      and old.stripe_checkout_session_id is not distinct from new.stripe_checkout_session_id then
      return new;
    end if;
  end if;

  select status into booking_status
  from public.booking_requests
  where id = new.booking_id
  for share;

  if booking_status is distinct from 'completed' then
    raise exception 'Only completed bookings can be paid after the work is finished.';
  end if;
  return new;
end;
$$;

revoke all on function private.require_finished_work_for_checkout() from public;
drop trigger if exists require_finished_work_for_checkout on public.booking_payments;
create trigger require_finished_work_for_checkout
  before insert or update of status, stripe_checkout_session_id
  on public.booking_payments
  for each row execute function private.require_finished_work_for_checkout();

create or replace function public.set_booking_price(
  requested_booking_id uuid,
  requested_amount_cents integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_provider_id uuid := (select auth.uid());
  selected_booking record;
begin
  if requested_amount_cents is null
    or requested_amount_cents < 100
    or requested_amount_cents > 100000000 then
    raise exception 'Enter a final price between $1.00 and $1,000,000.00.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = current_provider_id
      and role = 'provider'
      and provider_status = 'approved'
  ) then
    raise exception 'Only approved providers can set a booking price.';
  end if;

  select id, status
  into selected_booking
  from public.booking_requests
  where id = requested_booking_id
    and provider_id = current_provider_id
  for update;

  if not found then
    raise exception 'Booking request not found.';
  end if;

  if selected_booking.status not in ('accepted', 'completed') then
    raise exception 'Set a price only after accepting the booking.';
  end if;

  if exists (
    select 1
    from public.booking_payments
    where booking_id = requested_booking_id
      and status not in ('failed', 'expired')
  ) then
    raise exception 'The price cannot change after checkout has started.';
  end if;

  update public.booking_requests
  set
    agreed_price_cents = requested_amount_cents,
    price_set_at = timezone('utc', now())
  where id = requested_booking_id
    and provider_id = current_provider_id;

  update public.booking_payments
  set
    amount_cents = requested_amount_cents,
    platform_fee_cents = greatest(
      1,
      round(requested_amount_cents * 0.05)::integer
    )
  where booking_id = requested_booking_id
    and status in ('failed', 'expired');
end;
$$;

revoke all on function public.set_booking_price(uuid, integer) from public;
grant execute on function public.set_booking_price(uuid, integer)
  to authenticated;


create or replace function public.complete_booking(requested_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_provider_id uuid := (select auth.uid());
  selected_booking record;
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_provider_id
      and role = 'provider'
  ) then
    raise exception 'Only provider accounts can mark a booking complete.';
  end if;

  select id, status, requested_date, agreed_price_cents
  into selected_booking
  from public.booking_requests
  where id = requested_booking_id
    and provider_id = current_provider_id
  for update;

  if not found then
    raise exception 'Booking request not found.';
  end if;

  if selected_booking.status = 'completed' then
    return;
  end if;

  if selected_booking.status <> 'accepted' then
    raise exception 'Only accepted bookings can be marked complete.';
  end if;

  if selected_booking.requested_date > current_date then
    raise exception 'A future booking cannot be marked complete.';
  end if;

  if selected_booking.agreed_price_cents is null then
    raise exception 'Set the agreed final price before marking this booking complete.';
  end if;

  -- A legacy payment attempt might still be settling during rollout. Do not
  -- change the booking's stage while its result is unknown.
  if exists (
    select 1
    from public.booking_payments as payment
    where payment.booking_id = requested_booking_id
      and payment.status in ('checkout_pending', 'processing')
  ) then
    raise exception 'Wait for the existing checkout payment to finish or expire before completing this booking.';
  end if;

  if exists (
    select 1 from public.booking_payments
    where booking_id = requested_booking_id and status = 'refunded'
  ) then
    raise exception 'A fully refunded booking cannot be marked complete.';
  end if;

  update public.booking_requests
  set
    status = 'completed',
    completed_at = timezone('utc', now())
  where id = requested_booking_id
    and provider_id = current_provider_id;
end;
$$;

revoke all on function public.complete_booking(uuid) from public;
grant execute on function public.complete_booking(uuid) to authenticated;


create or replace function public.prepare_booking_payment(
  requested_booking_id uuid
)
returns table (
  payment_id uuid,
  provider_id uuid,
  stripe_account_id text,
  amount_cents integer,
  platform_fee_cents integer,
  checkout_attempt integer,
  stripe_checkout_session_id text,
  checkout_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer_id uuid := (select auth.uid());
  selected_booking record;
  selected_account_id text;
  selected_payment public.booking_payments%rowtype;
  calculated_fee integer;
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_customer_id
      and role = 'customer'
  ) then
    raise exception 'Only customer accounts can start checkout.';
  end if;

  select
    booking.id,
    booking.customer_id,
    booking.provider_id,
    booking.status,
    booking.agreed_price_cents
  into selected_booking
  from public.booking_requests as booking
  where booking.id = requested_booking_id
    and booking.customer_id = current_customer_id
  for update;

  if not found then
    raise exception 'Booking request not found.';
  end if;

  if selected_booking.status <> 'completed' then
    raise exception 'Only completed bookings can be paid after the work is finished.';
  end if;

  if selected_booking.agreed_price_cents is null then
    raise exception 'The provider must set a final price before checkout.';
  end if;

  select account.stripe_account_id
  into selected_account_id
  from public.provider_payment_accounts as account
  where account.provider_id = selected_booking.provider_id
    and account.details_submitted
    and account.payouts_enabled
    and account.transfers_active;

  if not found then
    raise exception 'This provider must finish Stripe payout setup before payment.';
  end if;

  calculated_fee := greatest(
    1,
    round(selected_booking.agreed_price_cents * 0.05)::integer
  );

  select payment.*
  into selected_payment
  from public.booking_payments as payment
  where payment.booking_id = requested_booking_id
  for update;

  if found then
    if selected_payment.status in (
      'paid',
      'processing',
      'partially_refunded',
      'refunded'
    ) then
      raise exception 'This booking already has a payment in progress or completed.';
    end if;

    -- A local expiry timestamp is not payment authority. Only a verified Stripe
    -- event or an account-scoped session reconciliation may expire an attempt.
    -- In particular, never discard IDs for a paid session awaiting its webhook.

    if selected_payment.status in ('failed', 'expired') then
      update public.booking_payments
      set
        stripe_account_id = selected_account_id,
        amount_cents = selected_booking.agreed_price_cents,
        platform_fee_cents = calculated_fee,
        status = 'checkout_pending',
        checkout_attempt = selected_payment.checkout_attempt + 1,
        stripe_checkout_session_id = null,
        stripe_payment_intent_id = null,
        stripe_charge_id = null,
        checkout_expires_at = null,
        paid_at = null,
        refunded_at = null
      where id = selected_payment.id
      returning * into selected_payment;
    end if;
  else
    insert into public.booking_payments (
      booking_id,
      customer_id,
      provider_id,
      stripe_account_id,
      amount_cents,
      platform_fee_cents
    )
    values (
      selected_booking.id,
      selected_booking.customer_id,
      selected_booking.provider_id,
      selected_account_id,
      selected_booking.agreed_price_cents,
      calculated_fee
    )
    returning * into selected_payment;
  end if;

  return query
  select
    selected_payment.id,
    selected_payment.provider_id,
    selected_payment.stripe_account_id,
    selected_payment.amount_cents,
    selected_payment.platform_fee_cents,
    selected_payment.checkout_attempt,
    selected_payment.stripe_checkout_session_id,
    selected_payment.checkout_expires_at;
end;
$$;

revoke all on function public.prepare_booking_payment(uuid) from public;
grant execute on function public.prepare_booking_payment(uuid)
  to authenticated;

create or replace function public.send_booking_message(
  requested_booking_id uuid,
  message_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_sender_id uuid := (select auth.uid());
  selected_booking record;
  created_message_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_sender_id
      and role in ('customer', 'provider')
  ) then
    raise exception 'Only customers and providers can send booking messages.';
  end if;

  select id, customer_id, provider_id, status, completed_at
  into selected_booking
  from public.booking_requests
  where id = requested_booking_id
    and current_sender_id in (customer_id, provider_id);

  if not found then
    raise exception 'Conversation not found.';
  end if;

  if selected_booking.status not in ('pending', 'accepted')
    and not (
      selected_booking.status = 'completed'
      and (
        selected_booking.completed_at > timezone('utc', now()) - interval '30 days'
        or not exists (
          select 1
          from public.booking_payments as payment
          where payment.booking_id = requested_booking_id
            and payment.status in ('paid', 'partially_refunded', 'refunded')
        )
      )
    )
  then
    raise exception 'This conversation is closed because the booking is no longer active.';
  end if;

  if char_length(trim(coalesce(message_body, ''))) < 1
    or char_length(trim(coalesce(message_body, ''))) > 2000
  then
    raise exception 'Messages must be between 1 and 2,000 characters.';
  end if;

  if (
    select count(*)
    from public.booking_messages
    where sender_id = current_sender_id
      and created_at > timezone('utc', now()) - interval '1 minute'
  ) >= 20 then
    raise exception 'Too many messages were sent. Wait a minute and try again.';
  end if;

  insert into public.booking_messages (booking_id, sender_id, body)
  values (requested_booking_id, current_sender_id, trim(message_body))
  returning id into created_message_id;

  return created_message_id;
end;
$$;

revoke all on function public.send_booking_message(uuid, text) from public;
grant execute on function public.send_booking_message(uuid, text)
  to authenticated;

commit;
