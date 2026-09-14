-- Auxilium booking resolution center.
-- Adds participant-visible support cases, audited admin decisions, Stripe refund
-- reconciliation, and card-dispute visibility without storing payment credentials.

alter table public.booking_payments
  add column if not exists refunded_amount_cents integer not null default 0;

alter table public.booking_payments
  drop constraint if exists booking_payments_refunded_amount_valid;
alter table public.booking_payments
  add constraint booking_payments_refunded_amount_valid check (
    refunded_amount_cents >= 0
    and refunded_amount_cents <= amount_cents
  );

create table if not exists public.booking_cases (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests (id) on delete restrict,
  payment_id uuid not null references public.booking_payments (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  category text not null check (
    category in ('cancellation', 'service_issue', 'duplicate_charge', 'other')
  ),
  requested_refund_cents integer not null check (requested_refund_cents >= 100),
  customer_details text not null check (
    char_length(customer_details) between 20 and 4000
  ),
  status text not null default 'open' check (
    status in (
      'open',
      'provider_responded',
      'under_review',
      'resolved_refunded',
      'resolved_partially_refunded',
      'denied',
      'closed'
    )
  ),
  provider_response text check (
    provider_response is null
    or char_length(provider_response) between 10 and 4000
  ),
  provider_responded_at timestamptz,
  admin_notes text check (
    admin_notes is null
    or char_length(admin_notes) between 10 and 4000
  ),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint booking_case_participants_differ check (customer_id <> provider_id)
);

comment on table public.booking_cases is
  'Customer-initiated paid-booking resolution requests visible to both participants and Auxilium admins.';

create unique index if not exists booking_cases_one_active_per_booking_idx
  on public.booking_cases (booking_id)
  where status in ('open', 'provider_responded', 'under_review');

create index if not exists booking_cases_admin_queue_idx
  on public.booking_cases (status, created_at desc);

drop trigger if exists set_booking_cases_updated_at on public.booking_cases;
create trigger set_booking_cases_updated_at
  before update on public.booking_cases
  for each row execute function private.set_updated_at();

alter table public.booking_cases enable row level security;
revoke all on table public.booking_cases from anon, authenticated;
grant select on table public.booking_cases to authenticated;
grant all on table public.booking_cases to service_role;

drop policy if exists "Participants can view their booking cases"
  on public.booking_cases;
create policy "Participants can view their booking cases"
  on public.booking_cases
  for select
  to authenticated
  using (
    (select auth.uid()) = customer_id
    or (select auth.uid()) = provider_id
  );

drop policy if exists "Admins can view booking cases"
  on public.booking_cases;
create policy "Admins can view booking cases"
  on public.booking_cases
  for select
  to authenticated
  using ((select private.is_admin()));

create table if not exists public.booking_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.booking_cases (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text not null check (
    actor_role in ('customer', 'provider', 'admin', 'stripe')
  ),
  event_type text not null check (
    event_type in (
      'opened',
      'provider_responded',
      'refund_started',
      'refund_succeeded',
      'refund_failed',
      'denied',
      'closed'
    )
  ),
  notes text,
  amount_cents integer check (amount_cents is null or amount_cents > 0),
  stripe_refund_id text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.booking_case_events enable row level security;
revoke all on table public.booking_case_events from anon, authenticated;
grant select on table public.booking_case_events to authenticated;
grant all on table public.booking_case_events to service_role;

drop policy if exists "Participants can view their booking case history"
  on public.booking_case_events;
create policy "Participants can view their booking case history"
  on public.booking_case_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.booking_cases as booking_case
      where booking_case.id = booking_case_events.case_id
        and (
          booking_case.customer_id = (select auth.uid())
          or booking_case.provider_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Admins can view booking case history"
  on public.booking_case_events;
create policy "Admins can view booking case history"
  on public.booking_case_events
  for select
  to authenticated
  using ((select private.is_admin()));

create table if not exists public.booking_refunds (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.booking_cases (id) on delete restrict,
  payment_id uuid not null references public.booking_payments (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency = 'usd'),
  status text not null default 'pending' check (
    status in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')
  ),
  source text not null default 'auxilium_admin' check (
    source in ('auxilium_admin', 'stripe_dashboard')
  ),
  requested_by uuid references public.profiles (id) on delete set null,
  stripe_refund_id text unique,
  stripe_charge_id text,
  failure_reason text,
  stripe_created_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.booking_refunds is
  'Stripe refund ledger. Refunds initiated by Auxilium reverse the destination transfer and proportional application fee.';

create unique index if not exists booking_refunds_one_pending_per_case_idx
  on public.booking_refunds (case_id)
  where case_id is not null and status in ('pending', 'requires_action');

create index if not exists booking_refunds_payment_created_idx
  on public.booking_refunds (payment_id, created_at desc);

drop trigger if exists set_booking_refunds_updated_at on public.booking_refunds;
create trigger set_booking_refunds_updated_at
  before update on public.booking_refunds
  for each row execute function private.set_updated_at();

alter table public.booking_refunds enable row level security;
revoke all on table public.booking_refunds from anon, authenticated;
grant select on table public.booking_refunds to authenticated;
grant all on table public.booking_refunds to service_role;

drop policy if exists "Participants can view their booking refunds"
  on public.booking_refunds;
create policy "Participants can view their booking refunds"
  on public.booking_refunds
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.booking_payments as payment
      where payment.id = booking_refunds.payment_id
        and (
          payment.customer_id = (select auth.uid())
          or payment.provider_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Admins can view booking refunds"
  on public.booking_refunds;
create policy "Admins can view booking refunds"
  on public.booking_refunds
  for select
  to authenticated
  using ((select private.is_admin()));

create table if not exists public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.booking_payments (id) on delete restrict,
  stripe_dispute_id text not null unique,
  stripe_charge_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null,
  reason text not null,
  status text not null,
  is_charge_refundable boolean not null default false,
  evidence_due_at timestamptz,
  livemode boolean not null,
  stripe_created_at timestamptz not null,
  last_event_created_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.payment_disputes is
  'Read-only local mirror of Stripe card disputes for admin and booking-participant visibility.';

create index if not exists payment_disputes_status_due_idx
  on public.payment_disputes (status, evidence_due_at);

drop trigger if exists set_payment_disputes_updated_at on public.payment_disputes;
create trigger set_payment_disputes_updated_at
  before update on public.payment_disputes
  for each row execute function private.set_updated_at();

alter table public.payment_disputes enable row level security;
revoke all on table public.payment_disputes from anon, authenticated;
grant select on table public.payment_disputes to authenticated;
grant all on table public.payment_disputes to service_role;

drop policy if exists "Participants can view their payment disputes"
  on public.payment_disputes;
create policy "Participants can view their payment disputes"
  on public.payment_disputes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.booking_payments as payment
      where payment.id = payment_disputes.payment_id
        and (
          payment.customer_id = (select auth.uid())
          or payment.provider_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Admins can view payment disputes"
  on public.payment_disputes;
create policy "Admins can view payment disputes"
  on public.payment_disputes
  for select
  to authenticated
  using ((select private.is_admin()));

create or replace function public.open_booking_case(
  requested_booking_id uuid,
  requested_category text,
  requested_refund_cents integer,
  requested_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer_id uuid := (select auth.uid());
  selected_booking public.booking_requests%rowtype;
  selected_payment public.booking_payments%rowtype;
  new_case_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = current_customer_id and role = 'customer'
  ) then
    raise exception 'Only customer accounts can open a resolution request.';
  end if;

  if requested_category not in (
    'cancellation', 'service_issue', 'duplicate_charge', 'other'
  ) then
    raise exception 'Choose a valid request category.';
  end if;

  requested_details := btrim(coalesce(requested_details, ''));
  if char_length(requested_details) < 20
    or char_length(requested_details) > 4000 then
    raise exception 'Explain the issue using 20 to 4,000 characters.';
  end if;

  select booking.*
  into selected_booking
  from public.booking_requests as booking
  where booking.id = requested_booking_id
    and booking.customer_id = current_customer_id;

  if not found then
    raise exception 'Booking request not found.';
  end if;

  select payment.*
  into selected_payment
  from public.booking_payments as payment
  where payment.booking_id = selected_booking.id
  for update;

  if not found or selected_payment.status not in ('paid', 'partially_refunded') then
    raise exception 'Only a successfully paid booking can request a refund.';
  end if;

  if requested_refund_cents is null
    or requested_refund_cents < 100
    or requested_refund_cents > (
      selected_payment.amount_cents - selected_payment.refunded_amount_cents
    ) then
    raise exception 'Requested refund exceeds the remaining refundable amount.';
  end if;

  if exists (
    select 1 from public.booking_cases
    where booking_id = selected_booking.id
      and status in ('open', 'provider_responded', 'under_review')
  ) then
    raise exception 'This booking already has an active resolution request.';
  end if;

  insert into public.booking_cases (
    booking_id,
    payment_id,
    customer_id,
    provider_id,
    category,
    requested_refund_cents,
    customer_details
  ) values (
    selected_booking.id,
    selected_payment.id,
    selected_booking.customer_id,
    selected_booking.provider_id,
    requested_category,
    requested_refund_cents,
    requested_details
  ) returning id into new_case_id;

  insert into public.booking_case_events (
    case_id, actor_id, actor_role, event_type, notes, amount_cents
  ) values (
    new_case_id,
    current_customer_id,
    'customer',
    'opened',
    requested_details,
    requested_refund_cents
  );

  return new_case_id;
end;
$$;

revoke all on function public.open_booking_case(uuid, text, integer, text)
  from public;
grant execute on function public.open_booking_case(uuid, text, integer, text)
  to authenticated;

create or replace function public.respond_to_booking_case(
  requested_case_id uuid,
  response_notes text
)
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
    raise exception 'Only provider accounts can respond to a resolution request.';
  end if;

  response_notes := btrim(coalesce(response_notes, ''));
  if char_length(response_notes) < 10
    or char_length(response_notes) > 4000 then
    raise exception 'Write a response using 10 to 4,000 characters.';
  end if;

  update public.booking_cases
  set
    provider_response = response_notes,
    provider_responded_at = timezone('utc', now()),
    status = 'provider_responded'
  where id = requested_case_id
    and provider_id = current_provider_id
    and status in ('open', 'provider_responded');

  if not found then
    raise exception 'This resolution request is not available for a response.';
  end if;

  insert into public.booking_case_events (
    case_id, actor_id, actor_role, event_type, notes
  ) values (
    requested_case_id,
    current_provider_id,
    'provider',
    'provider_responded',
    response_notes
  );
end;
$$;

revoke all on function public.respond_to_booking_case(uuid, text) from public;
grant execute on function public.respond_to_booking_case(uuid, text)
  to authenticated;

create or replace function public.deny_booking_case(
  requested_case_id uuid,
  review_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_admin_id uuid := (select auth.uid());
begin
  if not (select private.is_admin()) then
    raise exception 'Only Auxilium admins can decide resolution requests.';
  end if;

  review_notes := btrim(coalesce(review_notes, ''));
  if char_length(review_notes) < 10
    or char_length(review_notes) > 4000 then
    raise exception 'Explain the decision using 10 to 4,000 characters.';
  end if;

  update public.booking_cases as booking_case
  set
    status = 'denied',
    admin_notes = review_notes,
    resolved_by = current_admin_id,
    resolved_at = timezone('utc', now())
  where booking_case.id = requested_case_id
    and booking_case.status in ('open', 'provider_responded', 'under_review')
    and not exists (
      select 1 from public.booking_refunds as refund
      where refund.case_id = booking_case.id
        and refund.status in ('pending', 'requires_action')
    );

  if not found then
    raise exception 'This request cannot be denied while a refund is pending or after it is resolved.';
  end if;

  insert into public.booking_case_events (
    case_id, actor_id, actor_role, event_type, notes
  ) values (
    requested_case_id,
    current_admin_id,
    'admin',
    'denied',
    review_notes
  );
end;
$$;

revoke all on function public.deny_booking_case(uuid, text) from public;
grant execute on function public.deny_booking_case(uuid, text)
  to authenticated;

create or replace function public.prepare_booking_case_refund(
  requested_case_id uuid,
  requested_amount_cents integer,
  review_notes text
)
returns table (
  refund_id uuid,
  booking_id uuid,
  payment_id uuid,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  amount_cents integer,
  remaining_refundable_cents integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_admin_id uuid := (select auth.uid());
  selected_case public.booking_cases%rowtype;
  selected_payment public.booking_payments%rowtype;
  selected_refund public.booking_refunds%rowtype;
  remaining_cents integer;
begin
  if not (select private.is_admin()) then
    raise exception 'Only Auxilium admins can issue booking refunds.';
  end if;

  review_notes := btrim(coalesce(review_notes, ''));
  if char_length(review_notes) < 10
    or char_length(review_notes) > 4000 then
    raise exception 'Explain the refund decision using 10 to 4,000 characters.';
  end if;

  select booking_case.*
  into selected_case
  from public.booking_cases as booking_case
  where booking_case.id = requested_case_id
  for update;

  if not found or selected_case.status not in (
    'open', 'provider_responded', 'under_review'
  ) then
    raise exception 'This resolution request is no longer open.';
  end if;

  select payment.*
  into selected_payment
  from public.booking_payments as payment
  where payment.id = selected_case.payment_id
  for update;

  if not found or selected_payment.status not in ('paid', 'partially_refunded') then
    raise exception 'This payment is not eligible for another refund.';
  end if;

  remaining_cents := selected_payment.amount_cents
    - selected_payment.refunded_amount_cents;

  select refund.*
  into selected_refund
  from public.booking_refunds as refund
  where refund.case_id = selected_case.id
    and refund.status in ('pending', 'requires_action')
  order by refund.created_at desc
  limit 1
  for update;

  if found then
    if selected_refund.amount_cents <> requested_amount_cents then
      raise exception 'A refund for a different amount is already pending. Retry using the pending amount.';
    end if;

    return query select
      selected_refund.id,
      selected_case.booking_id,
      selected_payment.id,
      selected_payment.stripe_payment_intent_id,
      selected_payment.stripe_charge_id,
      selected_refund.amount_cents,
      remaining_cents;
    return;
  end if;

  if requested_amount_cents is null
    or requested_amount_cents < 100
    or requested_amount_cents > remaining_cents then
    raise exception 'Refund amount exceeds the remaining refundable balance.';
  end if;

  insert into public.booking_refunds (
    case_id, payment_id, amount_cents, requested_by
  ) values (
    selected_case.id,
    selected_payment.id,
    requested_amount_cents,
    current_admin_id
  ) returning * into selected_refund;

  update public.booking_cases
  set status = 'under_review', admin_notes = review_notes
  where id = selected_case.id;

  insert into public.booking_case_events (
    case_id, actor_id, actor_role, event_type, notes, amount_cents
  ) values (
    selected_case.id,
    current_admin_id,
    'admin',
    'refund_started',
    review_notes,
    requested_amount_cents
  );

  return query select
    selected_refund.id,
    selected_case.booking_id,
    selected_payment.id,
    selected_payment.stripe_payment_intent_id,
    selected_payment.stripe_charge_id,
    selected_refund.amount_cents,
    remaining_cents;
end;
$$;

revoke all on function public.prepare_booking_case_refund(uuid, integer, text)
  from public;
grant execute on function public.prepare_booking_case_refund(uuid, integer, text)
  to authenticated;

create or replace function public.record_booking_refund_state(
  internal_refund_id uuid,
  stripe_refund_id text,
  payment_intent_id text,
  charge_id text,
  refund_amount_cents integer,
  refund_currency text,
  refund_status text,
  refund_failure_reason text,
  stripe_created bigint,
  stripe_event_id text default null,
  stripe_event_type text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_refund public.booking_refunds%rowtype;
  selected_payment public.booking_payments%rowtype;
  inserted_event_id text;
  succeeded_total integer;
  normalized_status text;
  refund_found boolean := false;
  previous_refund_status text;
begin
  normalized_status := case
    when refund_status in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')
      then refund_status
    else 'pending'
  end;

  if internal_refund_id is not null then
    select refund.* into selected_refund
    from public.booking_refunds as refund
    where refund.id = internal_refund_id
    for update;
    refund_found := found;
  end if;

  if not refund_found and stripe_refund_id is not null then
    select refund.* into selected_refund
    from public.booking_refunds as refund
    where refund.stripe_refund_id = record_booking_refund_state.stripe_refund_id
    for update;
    refund_found := found;
  end if;

  if refund_found then
    select payment.* into selected_payment
    from public.booking_payments as payment
    where payment.id = selected_refund.payment_id
    for update;
  else
    select payment.* into selected_payment
    from public.booking_payments as payment
    where (
      charge_id is not null and payment.stripe_charge_id = charge_id
    ) or (
      payment_intent_id is not null
      and payment.stripe_payment_intent_id = payment_intent_id
    )
    limit 1
    for update;

    if not found then
      return false;
    end if;

  end if;

  if stripe_event_id is not null then
    insert into public.stripe_webhook_events (event_id, event_type)
    values (stripe_event_id, coalesce(stripe_event_type, 'refund.updated'))
    on conflict (event_id) do nothing
    returning event_id into inserted_event_id;

    if inserted_event_id is null then
      return false;
    end if;
  end if;

  if not refund_found then
    insert into public.booking_refunds (
      payment_id,
      amount_cents,
      currency,
      status,
      source,
      stripe_refund_id,
      stripe_charge_id,
      failure_reason,
      stripe_created_at
    ) values (
      selected_payment.id,
      refund_amount_cents,
      refund_currency,
      normalized_status,
      'stripe_dashboard',
      stripe_refund_id,
      charge_id,
      refund_failure_reason,
      to_timestamp(stripe_created)
    ) returning * into selected_refund;
  end if;

  if selected_refund.amount_cents <> refund_amount_cents
    or selected_payment.currency <> refund_currency then
    raise exception 'Stripe refund does not match the recorded payment.';
  end if;

  previous_refund_status := selected_refund.status;

  update public.booking_refunds
  set
    stripe_refund_id = coalesce(
      record_booking_refund_state.stripe_refund_id,
      booking_refunds.stripe_refund_id
    ),
    stripe_charge_id = coalesce(charge_id, booking_refunds.stripe_charge_id),
    status = normalized_status,
    failure_reason = refund_failure_reason,
    stripe_created_at = coalesce(
      booking_refunds.stripe_created_at,
      to_timestamp(stripe_created)
    )
  where id = selected_refund.id
  returning * into selected_refund;

  select coalesce(sum(refund.amount_cents), 0)::integer
  into succeeded_total
  from public.booking_refunds as refund
  where refund.payment_id = selected_payment.id
    and refund.status = 'succeeded';

  update public.booking_payments
  set
    stripe_charge_id = coalesce(charge_id, stripe_charge_id),
    refunded_amount_cents = succeeded_total,
    status = case
      when succeeded_total >= amount_cents then 'refunded'
      when succeeded_total > 0 then 'partially_refunded'
      else status
    end,
    refunded_at = case
      when succeeded_total > 0 then coalesce(refunded_at, timezone('utc', now()))
      else refunded_at
    end
  where id = selected_payment.id;

  if selected_refund.case_id is not null
    and normalized_status = 'succeeded'
    and previous_refund_status <> 'succeeded' then
    update public.booking_cases
    set
      status = case
        when succeeded_total >= selected_payment.amount_cents
          then 'resolved_refunded'
        else 'resolved_partially_refunded'
      end,
      resolved_by = coalesce(resolved_by, selected_refund.requested_by),
      resolved_at = coalesce(resolved_at, timezone('utc', now()))
    where id = selected_refund.case_id;

    insert into public.booking_case_events (
      case_id,
      actor_id,
      actor_role,
      event_type,
      amount_cents,
      stripe_refund_id
    ) values (
      selected_refund.case_id,
      selected_refund.requested_by,
      'stripe',
      'refund_succeeded',
      selected_refund.amount_cents,
      selected_refund.stripe_refund_id
    );

    if succeeded_total >= selected_payment.amount_cents then
      update public.booking_requests
      set status = 'cancelled'
      where id = selected_payment.booking_id and status = 'accepted';
    end if;
  elsif selected_refund.case_id is not null
    and normalized_status = 'failed'
    and previous_refund_status <> 'failed' then
    update public.booking_cases
    set status = 'under_review'
    where id = selected_refund.case_id;

    insert into public.booking_case_events (
      case_id,
      actor_id,
      actor_role,
      event_type,
      notes,
      amount_cents,
      stripe_refund_id
    ) values (
      selected_refund.case_id,
      null,
      'stripe',
      'refund_failed',
      refund_failure_reason,
      selected_refund.amount_cents,
      selected_refund.stripe_refund_id
    );
  end if;

  return true;
end;
$$;

revoke all on function public.record_booking_refund_state(
  uuid, text, text, text, integer, text, text, text, bigint, text, text
) from public;
grant execute on function public.record_booking_refund_state(
  uuid, text, text, text, integer, text, text, text, bigint, text, text
) to service_role;

create or replace function public.record_stripe_dispute_event(
  stripe_event_id text,
  stripe_event_type text,
  stripe_dispute_id text,
  payment_intent_id text,
  charge_id text,
  dispute_amount_cents integer,
  dispute_currency text,
  dispute_reason text,
  dispute_status text,
  charge_is_refundable boolean,
  evidence_due bigint,
  dispute_livemode boolean,
  stripe_created bigint,
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
begin
  if stripe_event_type not in (
    'charge.dispute.created',
    'charge.dispute.updated',
    'charge.dispute.closed',
    'charge.dispute.funds_withdrawn',
    'charge.dispute.funds_reinstated'
  ) then
    return false;
  end if;

  insert into public.stripe_webhook_events (event_id, event_type)
  values (stripe_event_id, stripe_event_type)
  on conflict (event_id) do nothing
  returning event_id into inserted_event_id;

  if inserted_event_id is null then
    return false;
  end if;

  select payment.* into selected_payment
  from public.booking_payments as payment
  where payment.stripe_charge_id = charge_id
    or (
      payment_intent_id is not null
      and payment.stripe_payment_intent_id = payment_intent_id
    )
  limit 1
  for update;

  if not found then
    return false;
  end if;

  update public.booking_payments
  set stripe_charge_id = coalesce(charge_id, stripe_charge_id)
  where id = selected_payment.id;

  insert into public.payment_disputes (
    payment_id,
    stripe_dispute_id,
    stripe_charge_id,
    amount_cents,
    currency,
    reason,
    status,
    is_charge_refundable,
    evidence_due_at,
    livemode,
    stripe_created_at,
    last_event_created_at
  ) values (
    selected_payment.id,
    record_stripe_dispute_event.stripe_dispute_id,
    charge_id,
    dispute_amount_cents,
    dispute_currency,
    dispute_reason,
    dispute_status,
    charge_is_refundable,
    case when evidence_due is null then null else to_timestamp(evidence_due) end,
    dispute_livemode,
    to_timestamp(stripe_created),
    to_timestamp(stripe_event_created)
  )
  on conflict on constraint payment_disputes_stripe_dispute_id_key do update
  set
    amount_cents = excluded.amount_cents,
    reason = excluded.reason,
    status = excluded.status,
    is_charge_refundable = excluded.is_charge_refundable,
    evidence_due_at = excluded.evidence_due_at,
    last_event_created_at = greatest(
      payment_disputes.last_event_created_at,
      excluded.last_event_created_at
    );

  return true;
end;
$$;

revoke all on function public.record_stripe_dispute_event(
  text, text, text, text, text, integer, text, text, text, boolean,
  bigint, boolean, bigint, bigint
) from public;
grant execute on function public.record_stripe_dispute_event(
  text, text, text, text, text, integer, text, text, text, boolean,
  bigint, boolean, bigint, bigint
) to service_role;
