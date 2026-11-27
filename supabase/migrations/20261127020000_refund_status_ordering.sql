-- Ignore older Stripe refund snapshots while retaining genuine bank returns.
-- Timestamp evidence is intentionally left null for existing rows; no ledger
-- or financial history is rewritten during installation.
begin;

alter table public.booking_refunds
  add column if not exists stripe_last_event_created bigint
  check (stripe_last_event_created is null or stripe_last_event_created >= 0);
comment on column public.booking_refunds.stripe_last_event_created is
  'Most recent verified Stripe event creation second recorded for this refund. Null means no recorded event timestamp; this is not a total ordering within a second.';

alter table public.booking_case_events
  drop constraint if exists booking_case_events_event_type_check;
alter table public.booking_case_events
  add constraint booking_case_events_event_type_check check (event_type in (
    'opened', 'provider_responded', 'refund_started', 'refund_succeeded',
    'refund_failed', 'refund_requires_action', 'refund_pending', 'refund_canceled', 'denied', 'closed'
  ));

create or replace function private.record_booking_refund_state(
  internal_refund_id uuid,
  stripe_refund_id text,
  payment_intent_id text,
  charge_id text,
  refund_amount_cents integer,
  refund_currency text,
  refund_status text,
  refund_failure_reason text,
  stripe_created bigint,
  stripe_event_id text,
  stripe_event_type text,
  stripe_event_created bigint,
  stripe_previous_refund_status text
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

  -- Compare known identity fields before recording a delivery fingerprint.
  if (selected_refund.stripe_refund_id is not null
      and stripe_refund_id is not null
      and selected_refund.stripe_refund_id <> stripe_refund_id)
    or (selected_payment.stripe_payment_intent_id is not null
      and payment_intent_id is not null
      and selected_payment.stripe_payment_intent_id <> payment_intent_id)
    or (selected_payment.stripe_charge_id is not null
      and charge_id is not null
      and selected_payment.stripe_charge_id <> charge_id)
  then
    raise exception 'Stripe refund does not match the recorded payment identity.';
  end if;

  if stripe_event_created is not null and stripe_event_created < 0 then
    raise exception 'Invalid Stripe refund event timestamp.';
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

  -- Event timestamps are a strictly-older filter, not a complete ordering:
  -- distinct Stripe events can share a second. Keep the delivery fingerprint
  -- while ignoring a snapshot older than the last verified recorded event.
  if stripe_event_created is not null
    and selected_refund.stripe_last_event_created is not null
    and stripe_event_created < selected_refund.stripe_last_event_created then
    return false;
  end if;

  if previous_refund_status in ('succeeded', 'failed', 'canceled')
    and normalized_status is distinct from previous_refund_status
    and stripe_event_created is null then
    if stripe_event_id is null then
      -- A delayed API response is not newer evidence than a terminal state.
      return false;
    end if;
    raise exception 'Stripe refund status needs a verified event transition before reconciliation.';
  end if;

  if previous_refund_status = 'succeeded'
    and normalized_status in ('pending', 'requires_action') then
    -- Some methods genuinely return to requires_action when a bank returns
    -- funds. Signed previous_attributes identifies that transition. A pending
    -- status can follow that return cycle only with a strictly newer event.
    if stripe_event_id is not null
      and stripe_event_type = 'refund.updated'
      and stripe_event_created is not null
      and (
        (normalized_status = 'requires_action' and stripe_previous_refund_status = 'succeeded')
        or (normalized_status = 'pending' and stripe_previous_refund_status = 'requires_action'
          and selected_refund.stripe_last_event_created is not null
          and stripe_event_created > selected_refund.stripe_last_event_created)
      ) then
      null;
    elsif stripe_event_created is not null
      and selected_refund.stripe_last_event_created is not null
      and stripe_event_created <= selected_refund.stripe_last_event_created then
      return false;
    elsif stripe_event_id is null then
      -- An earlier API response must not undo a confirmed webhook result.
      return false;
    else
      -- Old deployed webhook callers have no transition proof. Roll back the
      -- fingerprint so Stripe can retry after the matching app deployment.
      raise exception 'Stripe refund status needs a verified event transition before reconciliation.';
    end if;
  end if;

  if previous_refund_status in ('failed', 'canceled')
    and normalized_status is distinct from previous_refund_status then
    if (
      stripe_event_type = 'refund.updated'
      and stripe_event_created is not null
      and stripe_previous_refund_status = previous_refund_status
    ) is true then
      null;
    elsif stripe_event_created is not null
      and selected_refund.stripe_last_event_created is not null
      and stripe_event_created <= selected_refund.stripe_last_event_created then
      return false;
    else
      raise exception 'Stripe refund status needs a verified event transition before reconciliation.';
    end if;
  end if;

  update public.booking_refunds
  set
    stripe_refund_id = coalesce(
      record_booking_refund_state.stripe_refund_id,
      booking_refunds.stripe_refund_id
    ),
    stripe_charge_id = coalesce(charge_id, booking_refunds.stripe_charge_id),
    status = normalized_status,
    stripe_last_event_created = greatest(booking_refunds.stripe_last_event_created, stripe_event_created),
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
      when status in ('partially_refunded', 'refunded') then 'paid'
      else status
    end,
    refunded_at = case
      when succeeded_total > 0 then coalesce(refunded_at, timezone('utc', now()))
      else null
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
    and normalized_status in ('failed', 'canceled', 'requires_action', 'pending')
    and previous_refund_status is distinct from normalized_status
    and (normalized_status <> 'pending' or previous_refund_status = 'succeeded') then
    update public.booking_cases as changed_case
    set status = case when exists (
      select 1 from public.booking_cases as other_case
      where other_case.booking_id = changed_case.booking_id
        and other_case.id <> changed_case.id
        and other_case.status in ('open', 'provider_responded', 'under_review')
    ) then 'closed' else 'under_review' end,
    resolved_by = null,
    resolved_at = null
    where changed_case.id = selected_refund.case_id;

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
      case normalized_status
        when 'requires_action' then 'refund_requires_action'
        when 'pending' then 'refund_pending'
        when 'canceled' then 'refund_canceled'
        else 'refund_failed'
      end,
      refund_failure_reason,
      selected_refund.amount_cents,
      selected_refund.stripe_refund_id
    );
  end if;

  return true;
end;
$$;

-- Keep the existing action/legacy RPC contract; only verified webhook callers
-- supply event transition evidence through the distinct extended RPC.
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
language sql
security definer
set search_path = ''
as $$
  select private.record_booking_refund_state(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,null::bigint,null::text
  );
$$;

create or replace function public.record_booking_refund_event_state(
  internal_refund_id uuid,
  stripe_refund_id text,
  payment_intent_id text,
  charge_id text,
  refund_amount_cents integer,
  refund_currency text,
  refund_status text,
  refund_failure_reason text,
  stripe_created bigint,
  stripe_event_id text,
  stripe_event_type text,
  stripe_event_created bigint,
  stripe_previous_refund_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if stripe_event_created is null or stripe_event_created < 0
    or stripe_event_id is null or char_length(trim(stripe_event_id)) = 0 then
    raise exception 'A verified Stripe event identity and timestamp are required.';
  end if;
  return private.record_booking_refund_state(
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
  );
end;
$$;

revoke all on function private.record_booking_refund_state(
  uuid,text,text,text,integer,text,text,text,bigint,text,text,bigint,text
) from public, anon, authenticated, service_role;
revoke all on function public.record_booking_refund_state(
  uuid,text,text,text,integer,text,text,text,bigint,text,text
) from public, anon, authenticated;
grant execute on function public.record_booking_refund_state(
  uuid,text,text,text,integer,text,text,text,bigint,text,text
) to service_role;
revoke all on function public.record_booking_refund_event_state(
  uuid,text,text,text,integer,text,text,text,bigint,text,text,bigint,text
) from public, anon, authenticated;
grant execute on function public.record_booking_refund_event_state(
  uuid,text,text,text,integer,text,text,text,bigint,text,text,bigint,text
) to service_role;

commit;
