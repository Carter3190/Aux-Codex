import "server-only";

import { isSupabaseAdminConfigured } from "@/lib/supabase/admin-config";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const stripeConnectWebhookSecret =
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
const stripeLiveModeEnabled =
  process.env.STRIPE_LIVE_MODE_ENABLED?.trim().toLowerCase() === "true";

export type StripeMode = "test" | "live" | "unconfigured";

export function getStripeMode(): StripeMode {
  if (stripeSecretKey?.startsWith("sk_test_")) return "test";
  if (stripeSecretKey?.startsWith("sk_live_")) return "live";
  return "unconfigured";
}

export function isStripeLiveModeEnabled() {
  return getStripeMode() === "live" && stripeLiveModeEnabled;
}

export function isStripeServerConfigured() {
  const mode = getStripeMode();
  return Boolean(
    mode !== "unconfigured" &&
      (mode !== "live" || stripeLiveModeEnabled) &&
      isSupabaseAdminConfigured(),
  );
}

export function isStripeWebhookConfigured() {
  return Boolean(
    isStripeServerConfigured() && stripeWebhookSecret?.startsWith("whsec_"),
  );
}

export function isStripeConnectWebhookConfigured() {
  return Boolean(
    isStripeServerConfigured() &&
      stripeConnectWebhookSecret?.startsWith("whsec_"),
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

  if (stripeSecretKey.startsWith("sk_live_") && !stripeLiveModeEnabled) {
    throw new Error(
      "Live Stripe payments are locked. Set STRIPE_LIVE_MODE_ENABLED=true only after completing the launch checklist.",
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

export function getStripeWebhookSecrets() {
  const secrets = [stripeWebhookSecret, stripeConnectWebhookSecret].filter(
    (secret): secret is string => Boolean(secret?.startsWith("whsec_")),
  );

  if (secrets.length === 0) {
    throw new Error(
      "Stripe webhooks are not configured. Add STRIPE_WEBHOOK_SECRET and STRIPE_CONNECT_WEBHOOK_SECRET to .env.local.",
    );
  }

  return [...new Set(secrets)];
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
