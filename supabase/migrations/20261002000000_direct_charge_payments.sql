-- Tie every new booking payment to the provider Stripe account that owns its
-- direct charge. Existing destination-charge payments remain null so their
-- original platform-scoped refund path continues to work.

alter table public.booking_payments
  add column if not exists stripe_account_id text;

alter table public.booking_payments
  drop constraint if exists booking_payments_stripe_account_id_valid;
alter table public.booking_payments
  add constraint booking_payments_stripe_account_id_valid check (
    stripe_account_id is null
    or stripe_account_id ~ '^acct_[A-Za-z0-9]+$'
  );

create index if not exists booking_payments_stripe_account_idx
  on public.booking_payments (stripe_account_id);

comment on column public.booking_payments.stripe_account_id is
  'Connected account that owns this direct Stripe charge. Null identifies a legacy platform-owned destination charge.';

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

  if selected_booking.status <> 'accepted' then
    raise exception 'Only accepted bookings can be paid.';
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

    if selected_payment.status = 'checkout_pending'
      and selected_payment.checkout_expires_at is not null
      and selected_payment.checkout_expires_at <= timezone('utc', now()) then
      update public.booking_payments
      set status = 'expired'
      where id = selected_payment.id;
      selected_payment.status := 'expired';
    end if;

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
