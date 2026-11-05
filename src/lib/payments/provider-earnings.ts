import "server-only";

import type Stripe from "stripe";
import { requireRole } from "@/lib/auth/profile";
import type { BookingRequest } from "@/lib/marketplace/types";
import { createClient } from "@/lib/supabase/server";
import { isStripeServerConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { reconcileProviderEarnings, unresolvedProviderEarnings } from "./provider-earnings-presentation";
import type { EarningsBalance, EarningsPayment, ProviderEarnings } from "./provider-earnings-types";

export type { ProviderEarnings } from "./provider-earnings-types";

type PaymentRow = {
  id: string;
  booking_id: string;
  provider_id: string;
  amount_cents: number;
  platform_fee_cents: number;
  refunded_amount_cents: number;
  currency: string;
  status: string;
  stripe_account_id: string | null;
  stripe_charge_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
};

const settled = new Set(["paid", "partially_refunded", "refunded"]);
const maximumBatch = 20;
const concurrency = 4;
const budgetMs = 9_000;
const requestTimeoutMs = 3_000;

function objectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function balanceSnapshot(value: string | Stripe.BalanceTransaction | null): EarningsBalance | null {
  if (!value || typeof value === "string") return null;
  return {
    amount: value.amount,
    fee: value.fee,
    net: value.net,
    currency: value.currency,
    feeDetails: value.fee_details.map((detail) => ({
      amount: detail.amount,
      currency: detail.currency,
      type: detail.type,
    })),
  };
}

function rowPayment(row: PaymentRow): EarningsPayment {
  return {
    amountCents: row.amount_cents,
    platformFeeCents: row.platform_fee_cents,
    refundedAmountCents: row.refunded_amount_cents,
    currency: row.currency,
    status: row.status,
  };
}

function options(deadline: number, accountId?: string): Stripe.RequestOptions {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("Fee lookup time budget reached.");
  return {
    ...(accountId ? { stripeAccount: accountId } : {}),
    timeout: Math.max(1, Math.min(requestTimeoutMs, remaining)),
    maxNetworkRetries: 0,
  };
}

async function readCharge(row: PaymentRow, deadline: number): Promise<Stripe.Charge | null> {
  const stripe = getStripe();
  const accountId = row.stripe_account_id!;
  if (row.stripe_charge_id) {
    return stripe.charges.retrieve(row.stripe_charge_id, {
      expand: ["balance_transaction"],
    }, options(deadline, accountId));
  }

  let paymentIntentId = row.stripe_payment_intent_id;
  if (!paymentIntentId && row.stripe_checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(
      row.stripe_checkout_session_id,
      {},
      options(deadline, accountId),
    );
    if (session.metadata?.auxilium_payment_id && session.metadata.auxilium_payment_id !== row.id) return null;
    paymentIntentId = objectId(session.payment_intent);
  }
  if (!paymentIntentId) return null;
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  }, options(deadline, accountId));
  if (intent.metadata.auxilium_payment_id && intent.metadata.auxilium_payment_id !== row.id) return null;
  if (!intent.latest_charge) return null;
  return typeof intent.latest_charge === "string"
    ? stripe.charges.retrieve(intent.latest_charge, { expand: ["balance_transaction"] }, options(deadline, accountId))
    : intent.latest_charge;
}

async function earningsForRow(row: PaymentRow, deadline: number): Promise<ProviderEarnings> {
  const payment = rowPayment(row);
  const unavailable = (message: string) => unresolvedProviderEarnings(payment, "unavailable", message);
  if (!row.stripe_account_id) return unavailable("This historical payment uses an earlier payment model. Check Stripe for its retained earnings.");
  if (!/^acct_[A-Za-z0-9]+$/.test(row.stripe_account_id)) return unavailable("The payment's Stripe account could not be confirmed.");

  try {
    const charge = await readCharge(row, deadline);
    if (!charge) return unresolvedProviderEarnings(payment, "pending", "Stripe has not attached the complete charge records yet.");
    if (
      (row.stripe_payment_intent_id && objectId(charge.payment_intent) !== row.stripe_payment_intent_id) ||
      (charge.metadata.auxilium_payment_id && charge.metadata.auxilium_payment_id !== row.id) ||
      (charge.metadata.auxilium_booking_id && charge.metadata.auxilium_booking_id !== row.booking_id)
    ) return unavailable("The payment records could not be reconciled with Stripe.");
    if (charge.disputed) return unavailable("This payment has dispute adjustments. Check Stripe for the current retained amount.");
    const chargeBalance = charge.balance_transaction;
    if (chargeBalance && typeof chargeBalance !== "string" && objectId(chargeBalance.source) !== charge.id) return unavailable("The Stripe fee record does not match this charge.");
    if (!chargeBalance || typeof chargeBalance === "string" || !charge.application_fee) return unresolvedProviderEarnings(payment, "pending", "Stripe has not finalized the fee records for this payment yet.");

    const stripe = getStripe();
    const platformOptions = options(deadline);
    const connectedOptions = options(deadline, row.stripe_account_id);
    const [applicationFee, refunds] = await Promise.all([
      typeof charge.application_fee === "string"
        ? stripe.applicationFees.retrieve(charge.application_fee, {}, platformOptions)
        : Promise.resolve(charge.application_fee),
      stripe.refunds.list({
        charge: charge.id,
        limit: 100,
        expand: ["data.balance_transaction"],
      }, connectedOptions),
    ]);
    // Application fees are platform-owned; their account and charge must match
    // the connected charge before using their refund totals.
    if (objectId(applicationFee.account) !== row.stripe_account_id || objectId(applicationFee.charge) !== charge.id) return unavailable("The application-fee record could not be matched to this payment.");
    for (const refund of refunds.data) {
      if (objectId(refund.charge) !== charge.id) return unavailable("A refund record could not be matched to this payment.");
      if (refund.balance_transaction && typeof refund.balance_transaction !== "string" && objectId(refund.balance_transaction.source) !== refund.id) return unavailable("A refund fee record could not be matched to this payment.");
    }

    return reconcileProviderEarnings(payment, {
      currency: charge.currency,
      amount: charge.amount,
      capturedAmount: charge.amount_captured,
      refundedAmount: charge.amount_refunded,
      paid: charge.paid,
      captured: charge.captured,
      disputed: charge.disputed,
      balance: balanceSnapshot(charge.balance_transaction),
      applicationFee: {
        amount: applicationFee.amount,
        amountRefunded: applicationFee.amount_refunded,
        currency: applicationFee.currency,
      },
      refunds: refunds.data.map((refund) => ({
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        balance: balanceSnapshot(refund.balance_transaction),
      })),
      refundsComplete: !refunds.has_more,
    });
  } catch {
    return unavailable("Exact Stripe fee details are temporarily unavailable. Refresh later or check this payment in Stripe.");
  }
}

/**
 * Read-only, authenticated provider earnings. Stripe identifiers never enter
 * the returned presentation data. Fee lookups cannot change a payment, payout,
 * refund, account setting, or database row.
 *
 * A full history loads at most twenty payments within a short time budget.
 * Opening a booking calls this with that single booking to load older fees.
 */
export async function getProviderEarnings(
  bookings: BookingRequest[],
): Promise<Record<string, ProviderEarnings>> {
  const provider = await requireRole("provider");
  const owned = bookings.filter((booking) => booking.providerId === provider.id && booking.payment);
  const result: Record<string, ProviderEarnings> = {};
  for (const booking of owned) {
    result[booking.id] = unresolvedProviderEarnings(
      booking.payment!,
      settled.has(booking.payment!.status) ? "unavailable" : "pending",
      settled.has(booking.payment!.status)
        ? "Open this booking to load its exact Stripe fee details."
        : "Stripe will confirm its processing fee after payment.",
    );
  }
  const candidates = owned.filter((booking) => settled.has(booking.payment!.status)).slice(0, maximumBatch);
  if (candidates.length === 0) return result;
  for (const booking of candidates) result[booking.id] = unresolvedProviderEarnings(booking.payment!, "unavailable", "Exact Stripe fee details are temporarily unavailable. Refresh later or check this payment in Stripe.");
  if (!isStripeServerConfigured()) {
    for (const booking of candidates) result[booking.id] = unresolvedProviderEarnings(booking.payment!, "unavailable", "Stripe fee reporting is not available right now.");
    return result;
  }

  try {
    // Use the signed-in provider's own RLS-scoped client, not service-role
    // access. Both participant identity and known payment IDs are required.
    const supabase = await createClient();
    const { data, error } = await supabase.from("booking_payments")
      .select("id, booking_id, provider_id, amount_cents, platform_fee_cents, refunded_amount_cents, currency, status, stripe_account_id, stripe_charge_id, stripe_payment_intent_id, stripe_checkout_session_id")
      .eq("provider_id", provider.id)
      .in("id", candidates.map((booking) => booking.payment!.id))
      .abortSignal(AbortSignal.timeout(requestTimeoutMs));
    if (error || !data) return result;
    const rows = new Map((data as PaymentRow[]).map((row) => [row.id, row]));
    const deadline = Date.now() + budgetMs;
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, async () => {
      while (cursor < candidates.length) {
        const booking = candidates[cursor++];
        const row = rows.get(booking.payment!.id);
        if (!row || row.provider_id !== provider.id || row.booking_id !== booking.id || Date.now() >= deadline) continue;
        if (
          row.amount_cents !== booking.payment!.amountCents ||
          row.refunded_amount_cents !== booking.payment!.refundedAmountCents ||
          row.status !== booking.payment!.status
        ) {
          result[booking.id] = unresolvedProviderEarnings(booking.payment!, "pending", "Payment and refund details are being updated. Refresh shortly.");
          continue;
        }
        result[booking.id] = await earningsForRow(row, deadline);
      }
    }));
  } catch {
    // Keeping the rest of the dashboard available is preferable to guessing a
    // fee or failing the booking page when Stripe or reporting is unavailable.
  }
  return result;
}
