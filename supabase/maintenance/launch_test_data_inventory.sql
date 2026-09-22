-- READ-ONLY launch inventory. This file does not delete or update anything.
-- Run it in the Supabase SQL Editor before deciding which test accounts to
-- remove. Review every result manually; names containing "test" can be real.

with candidate_accounts as materialized (
  select id, email, full_name, role, provider_status, created_at
  from public.profiles
  where email ilike '%test%'
     or full_name ilike '%test%'
     or full_name ilike '%sandbox%'
)
select
  candidate.id,
  candidate.email,
  candidate.full_name,
  candidate.role,
  candidate.provider_status,
  candidate.created_at,
  (select count(*) from public.booking_requests booking
    where candidate.id in (booking.customer_id, booking.provider_id)) as bookings,
  (select count(*) from public.booking_payments payment
    where candidate.id in (payment.customer_id, payment.provider_id)) as payments,
  (select count(*) from public.booking_cases booking_case
    where candidate.id in (booking_case.customer_id, booking_case.provider_id)) as cases,
  (select count(*) from public.booking_messages message
    where message.sender_id = candidate.id) as messages_sent,
  (select count(*) from public.booking_reviews review
    where candidate.id in (review.customer_id, review.provider_id)) as reviews,
  (select count(*) from public.provider_services service
    where service.provider_id = candidate.id) as provider_services,
  (select count(*) from storage.objects object
    where object.bucket_id in ('provider-photos', 'provider-credentials')
      and split_part(object.name, '/', 1) = candidate.id::text) as stored_files
from candidate_accounts candidate
order by candidate.created_at;

-- Booking-level inventory for obvious launch-test language. Payment and Stripe
-- identifiers are intentionally included so each record can be reconciled with
-- Stripe before database cleanup is considered.
select
  booking.id as booking_id,
  booking.customer_name,
  booking.provider_name,
  booking.service_name,
  booking.status as booking_status,
  booking.requested_date,
  booking.customer_notes,
  payment.status as payment_status,
  payment.amount_cents,
  payment.refunded_amount_cents,
  payment.stripe_checkout_session_id,
  payment.stripe_payment_intent_id,
  payment.stripe_charge_id
from public.booking_requests booking
left join public.booking_payments payment on payment.booking_id = booking.id
where booking.customer_notes ilike '%test%'
   or booking.provider_response ilike '%test%'
   or booking.customer_name ilike '%test%'
   or booking.provider_name ilike '%test%'
order by booking.created_at;
