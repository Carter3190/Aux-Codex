import { isTransactionalEmailConfigured } from "@/lib/email/config";
import {
  getAppUrl,
  isStripeServerConfigured,
  isStripeWebhookConfigured,
} from "@/lib/stripe/config";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin-config";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function isAppUrlConfigured() {
  try {
    getAppUrl();
    return true;
  } catch {
    return false;
  }
}

function status() {
  const checks = {
    supabase: isSupabaseConfigured(),
    serverDatabase: isSupabaseAdminConfigured(),
    stripe: isStripeServerConfigured(),
    stripeWebhook: isStripeWebhookConfigured(),
    appUrl: isAppUrlConfigured(),
    transactionalEmail: isTransactionalEmailConfigured(),
  };
  const coreReady =
    checks.supabase &&
    checks.serverDatabase &&
    checks.stripe &&
    checks.stripeWebhook &&
    checks.appUrl;

  return { checks, coreReady };
}

export function GET() {
  const readiness = status();
  return Response.json(
    {
      status: readiness.coreReady ? "ready" : "configuration_required",
      notifications: readiness.checks.transactionalEmail
        ? "enabled"
        : "not_configured",
      timestamp: new Date().toISOString(),
    },
    {
      status: readiness.coreReady ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}

export function HEAD() {
  const readiness = status();
  return new Response(null, {
    status: readiness.coreReady ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
