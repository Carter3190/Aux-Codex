-- READ ONLY. Run before 20261111000000_payment_after_service.sql.
-- Do not clear a payment row or mark it expired merely to pass this check.
-- Every pending attempt must be reconciled with Stripe, even after local expiry.
-- A customer may have paid before expiry while the signed webhook is delayed.
-- checkout_pending includes preparations without a saved Stripe session: a
-- server request may still be creating that session, so those also block rollout.
select
  payment.id as payment_id,
  payment.booking_id,
  booking.status as booking_status,
  payment.status as payment_status,
  payment.stripe_account_id,
  payment.stripe_checkout_session_id,
  payment.checkout_expires_at,
  case
    when payment.checkout_expires_at is null then 'Reconcile unknown expiry with Stripe'
    when payment.checkout_expires_at > now() then 'Reconcile open Checkout with Stripe'
    else 'Reconcile with Stripe: local expiry does not prove unpaid'
  end as rollout_action
from public.booking_payments as payment
join public.booking_requests as booking on booking.id = payment.booking_id
where payment.status = 'checkout_pending'
order by payment.checkout_expires_at nulls first;

-- Pending/processing/settled totals for comparison before and after rollout.
select status, count(*) as payment_count, sum(amount_cents) as gross_cents,
       sum(platform_fee_cents) as platform_fee_cents
from public.booking_payments
group by status
order by status;
