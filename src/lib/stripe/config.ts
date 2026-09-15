import "server-only";

import { isSupabaseAdminConfigured } from "@/lib/supabase/admin-config";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

export function isStripeServerConfigured() {
  return Boolean(
    (stripeSecretKey?.startsWith("sk_test_") ||
      stripeSecretKey?.startsWith("sk_live_")) &&
      isSupabaseAdminConfigured(),
  );
}

export function isStripeWebhookConfigured() {
  return Boolean(
    isStripeServerConfigured() && stripeWebhookSecret?.startsWith("whsec_"),
  );
}

export function getStripeSecretKey() {
  if (
    !stripeSecretKey ||
    (!stripeSecretKey.startsWith("sk_test_") &&
      !stripeSecretKey.startsWith("sk_live_"))
  ) {
    throw new Error(
      "Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local.",
    );
  }

  return stripeSecretKey;
}

export function getStripeWebhookSecret() {
  if (!stripeWebhookSecret?.startsWith("whsec_")) {
    throw new Error(
      "Stripe webhooks are not configured. Add STRIPE_WEBHOOK_SECRET to .env.local.",
    );
  }

  return stripeWebhookSecret;
}

export function getAppUrl() {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      if (url.protocol === "https:" || url.hostname === "localhost") {
        return url.origin;
      }
    } catch {
      // The actionable error below is clearer than URL's parsing message.
    }

    throw new Error(
      "APP_URL must be an HTTPS origin or a localhost URL during development.",
    );
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (process.env.VERCEL_ENV !== "production" && vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  throw new Error("Add APP_URL to the production environment.");
}
