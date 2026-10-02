import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStripeWebhookSecrets,
  isStripeConnectWebhookConfigured,
  isStripeWebhookConfigured,
} from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

const checkoutEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);
const refundEvents = new Set([
  "refund.created",
  "refund.updated",
  "refund.failed",
]);
const disputeEvents = new Set([
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
]);

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }
  return session.payment_intent?.id ?? null;
}

function objectId(value: string | { id: string } | null) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function internalRefundId(refund: Stripe.Refund) {
  const value = refund.metadata?.auxilium_refund_id;
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

type PaymentLookup =
  | { checkoutSessionId: string }
  | { paymentIntentId: string | null; chargeId: string | null };

async function paymentBelongsToConnectedAccount(
  admin: ReturnType<typeof createAdminClient>,
  connectedAccountId: string | undefined,
  lookup: PaymentLookup,
) {
  if (!connectedAccountId) return true;

  const baseQuery = admin
    .from("booking_payments")
    .select("id")
    .eq("stripe_account_id", connectedAccountId);

  if ("checkoutSessionId" in lookup) {
    const { data, error } = await baseQuery
      .eq("stripe_checkout_session_id", lookup.checkoutSessionId)
      .maybeSingle();
    if (error) throw new Error("Unable to verify the connected payment account.");
    return Boolean(data);
  }

  const filters = [
    lookup.paymentIntentId
      ? `stripe_payment_intent_id.eq.${lookup.paymentIntentId}`
      : null,
    lookup.chargeId ? `stripe_charge_id.eq.${lookup.chargeId}` : null,
  ].filter((filter): filter is string => Boolean(filter));
  if (filters.length === 0) return false;

  const { data, error } = await baseQuery.or(filters.join(",")).maybeSingle();
  if (error) throw new Error("Unable to verify the connected payment account.");
  return Boolean(data);
}

function constructStripeEvent(payload: string, signature: string) {
  const stripe = getStripe();
  for (const secret of getStripeWebhookSecrets()) {
    try {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      // Each Stripe webhook destination has its own signing secret.
    }
  }
  return null;
}

export async function POST(request: Request) {
  if (
    !isStripeWebhookConfigured() &&
    !isStripeConnectWebhookConfigured()
  ) {
    return Response.json(
      { error: "Stripe webhook is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();
  const event = constructStripeEvent(payload, signature);
  if (!event) {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const admin = createAdminClient();
  const connectedAccountId =
    typeof event.account === "string" ? event.account : undefined;
  let error: { message: string } | null = null;

  try {
    if (checkoutEvents.has(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const matches = await paymentBelongsToConnectedAccount(
        admin,
        connectedAccountId,
        { checkoutSessionId: session.id },
      );
      if (!matches) return Response.json({ received: true });

      const result = await admin.rpc("record_stripe_checkout_event", {
        stripe_event_id: event.id,
        stripe_event_type: event.type,
        checkout_session_id: session.id,
        payment_intent_id: paymentIntentId(session),
        checkout_payment_status: session.payment_status,
        stripe_event_created: event.created,
      });
      error = result.error;
    } else if (refundEvents.has(event.type)) {
      const refund = event.data.object as Stripe.Refund;
      const refundPaymentIntentId = objectId(refund.payment_intent);
      const refundChargeId = objectId(refund.charge);
      const matches = await paymentBelongsToConnectedAccount(
        admin,
        connectedAccountId,
        {
          paymentIntentId: refundPaymentIntentId,
          chargeId: refundChargeId,
        },
      );
      if (!matches) return Response.json({ received: true });

      const result = await admin.rpc("record_booking_refund_state", {
        internal_refund_id: internalRefundId(refund),
        stripe_refund_id: refund.id,
        payment_intent_id: refundPaymentIntentId,
        charge_id: refundChargeId,
        refund_amount_cents: refund.amount,
        refund_currency: refund.currency,
        refund_status: refund.status ?? "pending",
        refund_failure_reason: refund.failure_reason ?? null,
        stripe_created: refund.created,
        stripe_event_id: event.id,
        stripe_event_type: event.type,
      });
      error = result.error;
    } else if (disputeEvents.has(event.type)) {
      const dispute = event.data.object as Stripe.Dispute;
      const disputePaymentIntentId = objectId(dispute.payment_intent);
      const disputeChargeId = objectId(dispute.charge);
      const matches = await paymentBelongsToConnectedAccount(
        admin,
        connectedAccountId,
        {
          paymentIntentId: disputePaymentIntentId,
          chargeId: disputeChargeId,
        },
      );
      if (!matches) return Response.json({ received: true });

      const result = await admin.rpc("record_stripe_dispute_event", {
        stripe_event_id: event.id,
        stripe_event_type: event.type,
        stripe_dispute_id: dispute.id,
        payment_intent_id: disputePaymentIntentId,
        charge_id: disputeChargeId,
        dispute_amount_cents: dispute.amount,
        dispute_currency: dispute.currency,
        dispute_reason: dispute.reason,
        dispute_status: dispute.status,
        charge_is_refundable: dispute.is_charge_refundable,
        evidence_due: dispute.evidence_details.due_by,
        dispute_livemode: dispute.livemode,
        stripe_created: dispute.created,
        stripe_event_created: event.created,
      });
      error = result.error;
    } else {
      return Response.json({ received: true });
    }
  } catch {
    return Response.json(
      { error: "Unable to verify the connected Stripe event." },
      { status: 500 },
    );
  }

  if (error) {
    return Response.json(
      { error: "Unable to record the signed Stripe event." },
      { status: 500 },
    );
  }

  return Response.json({ received: true });
}
