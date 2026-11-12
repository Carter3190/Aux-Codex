import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin-config";
import { isStripeServerConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import type { ProviderPaymentSetup } from "./types";
import { stripeSetupStatus } from "./stripe-setup-status";

type PaymentAccountRow = {
  provider_id: string;
  stripe_account_id: string;
  details_submitted: boolean;
  payouts_enabled: boolean;
  transfers_active: boolean;
  requirements_due_count: number;
};

export async function syncProviderPaymentAccount(
  providerId: string,
  stripeAccountId: string,
) {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(stripeAccountId);

  const admin = createAdminClient();
  const status = stripeSetupStatus(account);
  const detailsSubmitted = account.details_submitted;
  const payoutsEnabled = account.payouts_enabled;
  const paymentsEnabled = account.charges_enabled;
  const { error } = await admin
    .from("provider_payment_accounts")
    .update({
      details_submitted: detailsSubmitted,
      payouts_enabled: payoutsEnabled,
      // This legacy column now records whether direct charges are enabled.
      transfers_active: paymentsEnabled,
      requirements_due_count: status.requirementsDueCount,
      last_synced_at: new Date().toISOString(),
    })
    .eq("provider_id", providerId)
    .eq("stripe_account_id", stripeAccountId);

  if (error) {
    throw new Error("Unable to save the provider's Stripe status.");
  }

  return {
    account,
    ...status,
    detailsSubmitted,
    payoutsEnabled,
    paymentsEnabled,
  };
}

export async function getProviderPaymentSetup(
  providerId: string,
): Promise<ProviderPaymentSetup> {
  if (!isStripeServerConfigured() || !isSupabaseAdminConfigured()) {
    return {
      configured: false,
      migrationInstalled: true,
      hasAccount: false,
      detailsSubmitted: false,
      payoutsEnabled: false,
      paymentsEnabled: false,
      requirementsDueCount: 0,
      ready: false,
      status: "unavailable",
      statusFresh: false,
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("provider_payment_accounts")
    .select(
      "provider_id, stripe_account_id, details_submitted, payouts_enabled, transfers_active, requirements_due_count",
    )
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) {
    const migrationMissing = error.code === "42P01" || error.code === "PGRST205";
    return {
      configured: true,
      migrationInstalled: !migrationMissing,
      hasAccount: false,
      detailsSubmitted: false,
      payoutsEnabled: false,
      paymentsEnabled: false,
      requirementsDueCount: 0,
      ready: false,
      status: "unavailable",
      statusFresh: false,
      message: migrationMissing
        ? "Install the Stripe payments migration to continue."
        : "Unable to load Stripe payout setup.",
    };
  }

  if (!data) {
    return {
      configured: true,
      migrationInstalled: true,
      hasAccount: false,
      detailsSubmitted: false,
      payoutsEnabled: false,
      paymentsEnabled: false,
      requirementsDueCount: 0,
      ready: false,
      status: "not_started",
      statusFresh: true,
    };
  }

  const row = data as PaymentAccountRow;
  try {
    const status = await syncProviderPaymentAccount(
      providerId,
      row.stripe_account_id,
    );
    return {
      configured: true,
      migrationInstalled: true,
      hasAccount: true,
      detailsSubmitted: status.detailsSubmitted,
      payoutsEnabled: status.payoutsEnabled,
      paymentsEnabled: status.paymentsEnabled,
      requirementsDueCount: status.requirementsDueCount,
      ready: status.ready,
      status: status.status,
      statusFresh: true,
      pendingVerificationCount: status.pendingVerificationCount,
    };
  } catch {
    return {
      configured: true,
      migrationInstalled: true,
      hasAccount: true,
      detailsSubmitted: row.details_submitted,
      payoutsEnabled: row.payouts_enabled,
      paymentsEnabled: row.transfers_active,
      requirementsDueCount: row.requirements_due_count,
      ready:
        row.details_submitted &&
        row.payouts_enabled &&
        row.transfers_active,
      status: "unknown",
      statusFresh: false,
      message: "Stripe could not be reached. The last saved status is shown.",
    };
  }
}
