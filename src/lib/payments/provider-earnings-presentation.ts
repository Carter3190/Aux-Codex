import type {
  EarningsBalance,
  EarningsPayment,
  ProviderEarnings,
  ProviderEarningsSnapshot,
} from "./provider-earnings-types";

const settledStatuses = new Set(["paid", "partially_refunded", "refunded"]);
const paymentFeeTypes = new Set([
  "stripe_fee",
  "payment_method_passthrough_fee",
  "tax",
  "withheld_tax",
]);

export function unresolvedProviderEarnings(
  payment: EarningsPayment,
  status: "pending" | "unavailable" = "pending",
  message = "Stripe will confirm its processing fee after payment.",
): ProviderEarnings {
  return {
    status,
    currency: "usd",
    grossAmountCents: payment.amountCents,
    refundedAmountCents: payment.refundedAmountCents,
    platformFeeCents: null,
    platformFeeRefundedCents: null,
    stripeFeeCents: null,
    netEarningsCents: null,
    message,
  };
}

function integer(value: number) {
  return Number.isSafeInteger(value);
}

function splitBalance(balance: EarningsBalance) {
  if (
    balance.currency !== "usd" ||
    ![balance.amount, balance.fee, balance.net].every(integer) ||
    balance.net !== balance.amount - balance.fee
  ) return null;

  let applicationFee = 0;
  let stripeFee = 0;
  let hasStripeDetail = false;
  for (const detail of balance.feeDetails) {
    if (!integer(detail.amount) || detail.currency !== "usd") return null;
    if (detail.type === "application_fee") applicationFee += detail.amount;
    else if (paymentFeeTypes.has(detail.type)) {
      stripeFee += detail.amount;
      hasStripeDetail = true;
    } else return null;
  }
  if (applicationFee + stripeFee !== balance.fee) return null;
  return { applicationFee, stripeFee, hasStripeDetail };
}

/**
 * Reconcile actual Stripe records, never a published percentage estimate.
 * The charge balance's total fee already includes the application fee: split
 * it first so Auxilium's commission is not deducted a second time.
 */
export function reconcileProviderEarnings(
  payment: EarningsPayment,
  snapshot: ProviderEarningsSnapshot,
): ProviderEarnings {
  const pending = (message: string) => unresolvedProviderEarnings(payment, "pending", message);
  const unavailable = (message: string) => unresolvedProviderEarnings(payment, "unavailable", message);
  if (!settledStatuses.has(payment.status)) return pending("Stripe will confirm its processing fee after payment.");
  if (
    payment.currency !== "usd" || snapshot.currency !== "usd" ||
    ![payment.amountCents, payment.platformFeeCents, payment.refundedAmountCents,
      snapshot.amount, snapshot.capturedAmount, snapshot.refundedAmount].every(integer) ||
    payment.amountCents <= 0 || payment.platformFeeCents < 0 ||
    snapshot.amount !== payment.amountCents || snapshot.capturedAmount !== snapshot.amount
  ) return unavailable("The payment amounts or currency could not be reconciled with Stripe.");
  if (!snapshot.paid || !snapshot.captured) return pending("Stripe is still confirming this payment.");
  if (snapshot.disputed) return unavailable("This payment has dispute adjustments. Check Stripe for the current retained amount.");
  if (snapshot.refundedAmount !== payment.refundedAmountCents) return pending("Refund amounts are being reconciled with Stripe.");
  if (snapshot.refundedAmount < 0 || snapshot.refundedAmount > snapshot.amount) return unavailable("The refund amounts could not be reconciled with Stripe.");
  if (!snapshot.balance || !snapshot.applicationFee) return pending("Stripe has not finalized the fee records for this payment yet.");

  const original = splitBalance(snapshot.balance);
  const app = snapshot.applicationFee;
  if (
    !original || !original.hasStripeDetail || snapshot.balance.amount !== snapshot.amount ||
    app.currency !== "usd" || ![app.amount, app.amountRefunded].every(integer) ||
    app.amount !== payment.platformFeeCents || app.amountRefunded < 0 || app.amountRefunded > app.amount ||
    original.applicationFee !== app.amount
  ) return unavailable("The actual Stripe fee breakdown is not available for this payment.");
  if (!snapshot.refundsComplete) return unavailable("The complete refund ledger could not be loaded. Check Stripe for this payment.");

  let refundedAmount = 0;
  let stripeFeeCents = original.stripeFee;
  let refundApplicationEntries = 0;
  let balanceNet = snapshot.balance.net;
  for (const refund of snapshot.refunds) {
    if (refund.status === "failed" || refund.status === "canceled") {
      if (refund.balance) return unavailable("A failed refund has balance adjustments. Check Stripe for the current retained amount.");
      continue;
    }
    if (refund.status !== "succeeded") return pending("A refund is still processing. Net earnings will update when Stripe confirms it.");
    if (!integer(refund.amount) || refund.amount <= 0 || refund.currency !== "usd") return unavailable("The refund amounts or currency could not be reconciled with Stripe.");
    if (!refund.balance) return pending("Stripe is still finalizing a refund's fee details.");
    const fees = splitBalance(refund.balance);
    if (!fees || refund.balance.amount !== -refund.amount || fees.applicationFee > 0) return unavailable("The refund fee breakdown could not be reconciled with Stripe.");
    refundedAmount += refund.amount;
    stripeFeeCents += fees.stripeFee;
    refundApplicationEntries += fees.applicationFee;
    balanceNet += refund.balance.net;
  }
  if (refundedAmount !== snapshot.refundedAmount || -refundApplicationEntries > app.amountRefunded) return pending("Refund and application-fee records are still being reconciled with Stripe.");
  if (stripeFeeCents < 0) return unavailable("Additional fee adjustments need to be reviewed in Stripe.");

  const platformFeeCents = app.amount - app.amountRefunded;
  const netEarningsCents = snapshot.amount - refundedAmount - platformFeeCents - stripeFeeCents;
  // Application-fee credits can appear inside a refund transaction or as a
  // separate credit. Include each once, using the fee object's actual total.
  const reconciledBalanceNet = balanceNet + app.amountRefunded + refundApplicationEntries;
  if (netEarningsCents !== reconciledBalanceNet) return unavailable("The payment ledger could not be reconciled with Stripe.");

  return {
    status: "confirmed",
    currency: "usd",
    grossAmountCents: snapshot.amount,
    refundedAmountCents: refundedAmount,
    platformFeeCents,
    platformFeeRefundedCents: app.amountRefunded,
    stripeFeeCents,
    netEarningsCents,
    message: "After recorded refunds, Auxilium's retained fee, and Stripe payment fees. Bank deposits follow your Stripe payout schedule.",
  };
}
