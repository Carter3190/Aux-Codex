-- Auxilium Stripe Connect payment foundation.
-- Stripe owns payment credentials, identity verification, and bank details.
-- Auxilium stores only connected-account identifiers and payment state.

alter table public.booking_requests
  add column if not exists agreed_price_cents integer check (
    agreed_price_cents is null
    or agreed_price_cents between 100 and 100000000
  ),
  add column if not exists price_set_at timestamptz;

create table if not exists public.provider_payment_accounts (
  provider_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_account_id text not null unique check (
    stripe_account_id ~ '^acct_[A-Za-z0-9]+$'
  ),
  details_submitted boolean not null default false,
  payouts_enabled boolean not null default false,
  transfers_active boolean not null default false,
  requirements_due_count integer not null default 0 check (
    requirements_due_count >= 0
  ),
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.provider_payment_accounts is
  'Stripe connected-account identifiers and non-sensitive onboarding status. Bank and identity data remain in Stripe.';

drop trigger if exists set_provider_payment_accounts_updated_at
  on public.provider_payment_accounts;
create trigger set_provider_payment_accounts_updated_at
  before update on public.provider_payment_accounts
  for each row execute function private.set_updated_at();

alter table public.provider_payment_accounts enable row level security;

revoke all on table public.provider_payment_accounts from anon, authenticated;
grant select on table public.provider_payment_accounts to authenticated;
grant all on table public.provider_payment_accounts to service_role;

drop policy if exists "Providers can view their payment account"
  on public.provider_payment_accounts;
create policy "Providers can view their payment account"
  on public.provider_payment_accounts
  for select
  to authenticated
  using ((select auth.uid()) = provider_id);

drop policy if exists "Admins can view provider payment accounts"
  on public.provider_payment_accounts;
create policy "Admins can view provider payment accounts"
  on public.provider_payment_accounts
  for select
  to authenticated
  using ((select private.is_admin()));

create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.booking_requests (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  amount_cents integer not null check (amount_cents between 100 and 100000000),
  platform_fee_cents integer not null check (
    platform_fee_cents > 0
    and platform_fee_cents < amount_cents
  ),
  currency text not null default 'usd' check (currency = 'usd'),
  status text not null default 'checkout_pending' check (
    status in (
      'checkout_pending',
      'processing',
      'paid',
      'failed',
      'expired',
      'partially_refunded',
      'refunded'
    )
  ),
  checkout_attempt integer not null default 1 check (checkout_attempt > 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text unique,
  checkout_expires_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  last_event_created_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint booking_payment_participants_differ check (customer_id <> provider_id),
  constraint booking_payment_fee_is_five_percent check (
    platform_fee_cents = greatest(1, round(amount_cents * 0.05)::integer)
  )
);

comment on table public.booking_payments is
  'One Stripe Checkout payment per booking. The application fee is exactly 5% of the customer charge, rounded to the nearest cent.';

create index if not exists booking_payments_customer_created_idx
  on public.booking_payments (customer_id, created_at desc);

create index if not exists booking_payments_provider_created_idx
  on public.booking_payments (provider_id, created_at desc);

drop trigger if exists set_booking_payments_updated_at on public.booking_payments;
create trigger set_booking_payments_updated_at
  before update on public.booking_payments
  for each row execute function private.set_updated_at();

alter table public.booking_payments enable row level security;

revoke all on table public.booking_payments from anon, authenticated;
grant select on table public.booking_payments to authenticated;
grant all on table public.booking_payments to service_role;

drop policy if exists "Participants can view their booking payment"
  on public.booking_payments;
create policy "Participants can view their booking payment"
  on public.booking_payments
  for select
  to authenticated
  using (
    (select auth.uid()) = customer_id
    or (select auth.uid()) = provider_id
  );

drop policy if exists "Admins can view booking payments"
  on public.booking_payments;
create policy "Admins can view booking payments"
  on public.booking_payments
  for select
  to authenticated
  using ((select private.is_admin()));

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  stripe_checkout_session_id text,
  received_at timestamptz not null default timezone('utc', now())
);

comment on table public.stripe_webhook_events is
  'Idempotency ledger for verified Stripe webhook events.';

alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;

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

  if selected_booking.status <> 'accepted' then
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
  selected_account record;
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
  into selected_account
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
      amount_cents,
      platform_fee_cents
    )
    values (
      selected_booking.id,
      selected_booking.customer_id,
      selected_booking.provider_id,
      selected_booking.agreed_price_cents,
      calculated_fee
    )
    returning * into selected_payment;
  end if;

  return query
  select
    selected_payment.id,
    selected_payment.provider_id,
    selected_account.stripe_account_id,
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

create or replace function public.record_stripe_checkout_event(
  stripe_event_id text,
  stripe_event_type text,
  checkout_session_id text,
  payment_intent_id text,
  checkout_payment_status text,
  stripe_event_created bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_payment public.booking_payments%rowtype;
  inserted_event_id text;
  event_time timestamptz := to_timestamp(stripe_event_created);
begin
  if stripe_event_type not in (
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired'
  ) then
    return false;
  end if;

  select payment.*
  into selected_payment
  from public.booking_payments as payment
  where payment.stripe_checkout_session_id = checkout_session_id
  for update;

  if not found then
    return false;
  end if;

  insert into public.stripe_webhook_events (
    event_id,
    event_type,
    stripe_checkout_session_id
  )
  values (
    stripe_event_id,
    stripe_event_type,
    checkout_session_id
  )
  on conflict (event_id) do nothing
  returning event_id into inserted_event_id;

  if inserted_event_id is null then
    return false;
  end if;

  if stripe_event_type in (
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded'
  ) and checkout_payment_status = 'paid' then
    update public.booking_payments
    set
      status = 'paid',
      stripe_payment_intent_id = coalesce(
        payment_intent_id,
        stripe_payment_intent_id
      ),
      paid_at = coalesce(paid_at, event_time),
      last_event_created_at = greatest(
        coalesce(last_event_created_at, event_time),
        event_time
      )
    where id = selected_payment.id;
  elsif stripe_event_type = 'checkout.session.completed'
    and selected_payment.status = 'checkout_pending' then
    update public.booking_payments
    set
      status = 'processing',
      stripe_payment_intent_id = coalesce(
        payment_intent_id,
        stripe_payment_intent_id
      ),
      last_event_created_at = greatest(
        coalesce(last_event_created_at, event_time),
        event_time
      )
    where id = selected_payment.id;
  elsif stripe_event_type = 'checkout.session.async_payment_failed'
    and selected_payment.status not in (
      'paid',
      'partially_refunded',
      'refunded'
    ) then
    update public.booking_payments
    set
      status = 'failed',
      last_event_created_at = greatest(
        coalesce(last_event_created_at, event_time),
        event_time
      )
    where id = selected_payment.id;
  elsif stripe_event_type = 'checkout.session.expired'
    and selected_payment.status = 'checkout_pending' then
    update public.booking_payments
    set
      status = 'expired',
      last_event_created_at = greatest(
        coalesce(last_event_created_at, event_time),
        event_time
      )
    where id = selected_payment.id;
  end if;

  return true;
end;
$$;

revoke all on function public.record_stripe_checkout_event(
  text,
  text,
  text,
  text,
  text,
  bigint
) from public;
grant execute on function public.record_stripe_checkout_event(
  text,
  text,
  text,
  text,
  text,
  bigint
) to service_role;

create or replace function public.cancel_booking(requested_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer_id uuid := (select auth.uid());
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_customer_id
      and role = 'customer'
  ) then
    raise exception 'Only customer accounts can cancel booking requests.';
  end if;

  update public.booking_requests as booking
  set status = 'cancelled'
  where booking.id = requested_booking_id
    and booking.customer_id = current_customer_id
    and booking.status in ('pending', 'accepted')
    and not exists (
      select 1
      from public.booking_payments as payment
      where payment.booking_id = booking.id
        and payment.status in (
          'checkout_pending',
          'processing',
          'paid',
          'partially_refunded',
          'refunded'
        )
    );

  if not found then
    raise exception 'This booking cannot be cancelled after payment has started.';
  end if;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public;
grant execute on function public.cancel_booking(uuid) to authenticated;
