import "server-only";

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin-config";
import { isStripeServerConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import type { ProviderPaymentSetup } from "./types";

type PaymentAccountRow = {
  provider_id: string;
  stripe_account_id: string;
  details_submitted: boolean;
  payouts_enabled: boolean;
  transfers_active: boolean;
  requirements_due_count: number;
};

function recipientBalanceCapabilities(account: Stripe.V2.Core.Account) {
  return account.configuration?.recipient?.capabilities?.stripe_balance;
}

function requirementsDueCount(account: Stripe.V2.Core.Account) {
  return (account.requirements?.entries ?? []).filter(
    (entry) => entry.awaiting_action_from === "user",
  ).length;
}

export async function syncProviderPaymentAccount(
  providerId: string,
  stripeAccountId: string,
) {
  const stripe = getStripe();
  const account = await stripe.v2.core.accounts.retrieve(stripeAccountId, {
    include: ["configuration.recipient", "requirements"],
  });
  if (account.closed) {
    throw new Error("The provider's Stripe account is no longer available.");
  }

  const admin = createAdminClient();
  const dueCount = requirementsDueCount(account);
  const balanceCapabilities = recipientBalanceCapabilities(account);
  const detailsSubmitted = dueCount === 0;
  const payoutsEnabled = balanceCapabilities?.payouts?.status === "active";
  const transfersActive =
    balanceCapabilities?.stripe_transfers?.status === "active";
  const { error } = await admin
    .from("provider_payment_accounts")
    .update({
      details_submitted: detailsSubmitted,
      payouts_enabled: payoutsEnabled,
      transfers_active: transfersActive,
      requirements_due_count: dueCount,
      last_synced_at: new Date().toISOString(),
    })
    .eq("provider_id", providerId)
    .eq("stripe_account_id", stripeAccountId);

  if (error) {
    throw new Error("Unable to save the provider's Stripe status.");
  }

  return {
    account,
    ready: detailsSubmitted && payoutsEnabled && transfersActive,
    detailsSubmitted,
    payoutsEnabled,
    transfersActive,
    requirementsDueCount: dueCount,
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
      transfersActive: false,
      requirementsDueCount: 0,
      ready: false,
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
      transfersActive: false,
      requirementsDueCount: 0,
      ready: false,
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
      transfersActive: false,
      requirementsDueCount: 0,
      ready: false,
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
      transfersActive: status.transfersActive,
      requirementsDueCount: status.requirementsDueCount,
      ready: status.ready,
    };
  } catch {
    return {
      configured: true,
      migrationInstalled: true,
      hasAccount: true,
      detailsSubmitted: row.details_submitted,
      payoutsEnabled: row.payouts_enabled,
      transfersActive: row.transfers_active,
      requirementsDueCount: row.requirements_due_count,
      ready:
        row.details_submitted &&
        row.payouts_enabled &&
        row.transfers_active,
      message: "Stripe could not be reached. The last saved status is shown.",
    };
  }
}
