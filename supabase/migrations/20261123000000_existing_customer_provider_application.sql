-- Let an existing customer apply as a provider using the same identity.
-- Customer access is retained; bookings, payments, messages and legal evidence
-- are neither moved nor rewritten. Approval and payout restrictions stay intact.
begin;

alter table public.profiles add column if not exists customer_access boolean not null default false;
comment on column public.profiles.customer_access is
  'Retains customer capabilities when that customer starts a provider application. Only the enrollment function may enable it for the authenticated customer.';

create or replace function public.start_provider_application()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_id uuid := (select auth.uid());
  selected_profile_role public.user_role;
begin
  if current_id is null then
    raise exception 'Sign in before starting your provider application.';
  end if;
  select role into selected_profile_role from public.profiles where id = current_id for update;
  if selected_profile_role is null then
    raise exception 'Your account profile is unavailable.';
  end if;
  if selected_profile_role = 'provider' then
    return;
  end if;
  if selected_profile_role <> 'customer' then
    raise exception 'Only customer accounts can start a provider application.';
  end if;

  update public.profiles
  set role = 'provider', provider_status = 'pending', customer_access = true
  where id = current_id and role = 'customer';

  insert into public.provider_details (provider_id)
  values (current_id)
  on conflict (provider_id) do nothing;
end;
$$;
revoke all on function public.start_provider_application() from public, anon;
grant execute on function public.start_provider_application() to authenticated;

create or replace function public.request_booking(
  requested_provider_id uuid,
  requested_service_id uuid,
  requested_date date,
  requested_start_time time,
  requested_location text,
  requested_notes text default '',
  provider_responsibility_acknowledged boolean default false,
  accepted_terms_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer_id uuid := (select auth.uid());
  customer_display_name text;
  provider_display_name text;
  selected_service record;
  created_booking_id uuid;
  current_terms_version text;
begin
  select full_name
  into customer_display_name
  from public.profiles
  where id = current_customer_id
    and (role = 'customer' or customer_access);

  if customer_display_name is null then
    raise exception 'Only customer accounts can request a booking.';
  end if;

  if provider_responsibility_acknowledged is distinct from true then
    raise exception 'Confirm that the provider performs the service and accept the current Terms of Service.';
  end if;

  if exists (
    with current_account_documents as (
      select distinct on (version.document_key)
        version.document_key,
        version.document_version
      from public.legal_document_versions as version
      where version.audience = 'all'
        and version.effective_at <= timezone('utc', now())
      order by version.document_key, version.effective_at desc, version.created_at desc
    )
    select 1
    from current_account_documents as document
    where not exists (
      select 1
      from public.legal_acceptances as acceptance
      where acceptance.user_id = current_customer_id
        and acceptance.document_key = document.document_key
        and acceptance.document_version = document.document_version
    )
  ) then
    raise exception 'Review and accept the current account agreements before requesting a booking.';
  end if;

  select version.document_version
  into current_terms_version
  from public.legal_document_versions as version
  where version.document_key = 'terms'
    and version.effective_at <= timezone('utc', now())
  order by version.effective_at desc, version.created_at desc
  limit 1;

  if current_terms_version is null
    or accepted_terms_version is distinct from current_terms_version
  then
    raise exception 'The Terms of Service changed. Refresh this page, review the current Terms, and try again.';
  end if;

  select coalesce(nullif(trim(details.business_name), ''), profile.full_name)
  into provider_display_name
  from public.profiles as profile
  join public.provider_details as details
    on details.provider_id = profile.id
  where profile.id = requested_provider_id
    and profile.role = 'provider'
    and profile.provider_status = 'approved';

  if provider_display_name is null then
    raise exception 'This provider is not currently available for booking.';
  end if;

  select service.id, service.name, service.pricing_type, service.price_cents
  into selected_service
  from public.provider_services as service
  where service.id = requested_service_id
    and service.provider_id = requested_provider_id
    and service.is_active;

  if not found then
    raise exception 'Choose an active service from this provider.';
  end if;

  if requested_date is null
    or requested_date <= current_date
    or requested_date > current_date + 365
  then
    raise exception 'Choose a date between tomorrow and one year from today.';
  end if;

  if requested_start_time is null or not exists (
    select 1
    from public.provider_availability as availability
    where availability.provider_id = requested_provider_id
      and availability.weekday = extract(dow from requested_date)::smallint
      and availability.is_available
      and availability.start_time <= requested_start_time
      and availability.end_time > requested_start_time
  ) then
    raise exception 'Choose a time within this provider''s listed availability.';
  end if;

  if char_length(trim(coalesce(requested_location, ''))) < 5
    or char_length(trim(coalesce(requested_location, ''))) > 300
  then
    raise exception 'Enter a service location between 5 and 300 characters.';
  end if;

  if char_length(trim(coalesce(requested_notes, ''))) > 2000 then
    raise exception 'Use 2,000 characters or fewer for request notes.';
  end if;

  if (
    select count(*)
    from public.booking_requests
    where customer_id = current_customer_id
      and status = 'pending'
  ) >= 20 then
    raise exception 'You already have 20 pending requests. Wait for a response or cancel one.';
  end if;

  insert into public.booking_requests (
    customer_id,
    provider_id,
    service_id,
    customer_name,
    provider_name,
    service_name,
    pricing_type,
    price_cents,
    requested_date,
    requested_start_time,
    service_location,
    customer_notes
  )
  values (
    current_customer_id,
    requested_provider_id,
    selected_service.id,
    customer_display_name,
    provider_display_name,
    selected_service.name,
    selected_service.pricing_type,
    selected_service.price_cents,
    requested_date,
    requested_start_time,
    trim(requested_location),
    trim(coalesce(requested_notes, ''))
  )
  returning id into created_booking_id;

  perform public.record_current_legal_acceptances(
    array['terms']::text[],
    'booking_request',
    created_booking_id
  );

  return created_booking_id;
exception
  when unique_violation then
    raise exception 'You already have an active request for this provider at that time.';
end;
$$;

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
      and (role = 'customer' or customer_access)
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
      and (role = 'customer' or customer_access)
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

create or replace function public.create_booking_review(
  requested_booking_id uuid,
  review_rating integer,
  review_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_customer_id uuid := (select auth.uid());
  selected_booking record;
  created_review_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where id = current_customer_id
      and (role = 'customer' or customer_access)
  ) then
    raise exception 'Only customer accounts can review a booking.';
  end if;

  if review_rating is null or review_rating < 1 or review_rating > 5 then
    raise exception 'Choose a rating from 1 to 5 stars.';
  end if;

  if char_length(trim(coalesce(review_body, ''))) < 10
    or char_length(trim(coalesce(review_body, ''))) > 2000
  then
    raise exception 'Reviews must be between 10 and 2,000 characters.';
  end if;

  select id, customer_id, provider_id, status
  into selected_booking
  from public.booking_requests
  where id = requested_booking_id
    and customer_id = current_customer_id
  for update;

  if not found then
    raise exception 'Booking request not found.';
  end if;

  if selected_booking.status <> 'completed' then
    raise exception 'The provider must mark this booking complete before it can be reviewed.';
  end if;

  if not exists (
    select 1
    from public.booking_payments as payment
    where payment.booking_id = requested_booking_id
      and payment.status in ('paid', 'partially_refunded')
  ) then
    raise exception 'Only successfully paid bookings can be reviewed.';
  end if;

  insert into public.booking_reviews (
    booking_id,
    customer_id,
    provider_id,
    rating,
    body
  )
  values (
    selected_booking.id,
    selected_booking.customer_id,
    selected_booking.provider_id,
    review_rating,
    trim(review_body)
  )
  returning id into created_review_id;

  return created_review_id;
exception
  when unique_violation then
    raise exception 'You already reviewed this booking.';
end;
$$;

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
    where id = current_customer_id and (role = 'customer' or customer_access)
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

commit;
