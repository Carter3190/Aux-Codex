import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStripeWebhookSecret,
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

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }
  return session.payment_intent?.id ?? null;
}

export async function POST(request: Request) {
  if (!isStripeWebhookConfigured()) {
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
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
  } catch {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (!checkoutEvents.has(event.type)) {
    return Response.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_stripe_checkout_event", {
    stripe_event_id: event.id,
    stripe_event_type: event.type,
    checkout_session_id: session.id,
    payment_intent_id: paymentIntentId(session),
    checkout_payment_status: session.payment_status,
    stripe_event_created: event.created,
  });

  if (error) {
    return Response.json(
      { error: "Unable to record the Stripe event." },
      { status: 500 },
    );
  }

  return Response.json({ received: true });
}
