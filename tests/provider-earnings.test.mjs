import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcileProviderEarnings } from "../src/lib/payments/provider-earnings-presentation.ts";

function payment(overrides = {}) {
  return { amountCents: 8000, platformFeeCents: 400, refundedAmountCents: 0, currency: "usd", status: "paid", ...overrides };
}

function snapshot(overrides = {}) {
  return {
    currency: "usd", amount: 8000, capturedAmount: 8000, refundedAmount: 0,
    paid: true, captured: true, disputed: false,
    balance: { amount: 8000, fee: 662, net: 7338, currency: "usd", feeDetails: [
      { amount: 400, currency: "usd", type: "application_fee" },
      { amount: 262, currency: "usd", type: "stripe_fee" },
    ] },
    applicationFee: { amount: 400, amountRefunded: 0, currency: "usd" },
    refunds: [], refundsComplete: true, ...overrides,
  };
}

function refund(amount, feeDetails = [], fee = 0) {
  return { amount, currency: "usd", status: "succeeded", balance: {
    amount: -amount, currency: "usd", fee, net: -amount - fee, feeDetails,
  } };
}

test("actual Stripe and application fees are separated without deducting commission twice", () => {
  const result = reconcileProviderEarnings(payment(), snapshot());
  assert.equal(result.status, "confirmed");
  assert.equal(result.platformFeeCents, 400);
  assert.equal(result.stripeFeeCents, 262);
  assert.equal(result.netEarningsCents, 7338);
  assert.equal(result.grossAmountCents - result.platformFeeCents - result.stripeFeeCents, result.netEarningsCents);
});

test("actual cents reconcile even when percentages would independently round differently", () => {
  const result = reconcileProviderEarnings(payment({ amountCents: 10010, platformFeeCents: 501 }), snapshot({
    amount: 10010, capturedAmount: 10010,
    applicationFee: { amount: 501, amountRefunded: 0, currency: "usd" },
    balance: { amount: 10010, fee: 821, net: 9189, currency: "usd", feeDetails: [
      { amount: 501, currency: "usd", type: "application_fee" },
      { amount: 320, currency: "usd", type: "stripe_fee" },
    ] },
  }));
  assert.equal(result.status, "confirmed");
  assert.equal(result.netEarningsCents, 9189);
});

test("partial refunds use actual returned application fees and retain Stripe costs", () => {
  const result = reconcileProviderEarnings(payment({ status: "partially_refunded", refundedAmountCents: 4000 }), snapshot({
    refundedAmount: 4000,
    applicationFee: { amount: 400, amountRefunded: 200, currency: "usd" },
    refunds: [refund(4000)],
  }));
  assert.equal(result.status, "confirmed");
  assert.equal(result.platformFeeCents, 200);
  assert.equal(result.platformFeeRefundedCents, 200);
  assert.equal(result.stripeFeeCents, 262);
  assert.equal(result.netEarningsCents, 3538);
});

test("application-fee credits inside refund balances are included exactly once", () => {
  const result = reconcileProviderEarnings(payment({ status: "partially_refunded", refundedAmountCents: 4000 }), snapshot({
    refundedAmount: 4000,
    applicationFee: { amount: 400, amountRefunded: 200, currency: "usd" },
    refunds: [refund(4000, [{ amount: -200, currency: "usd", type: "application_fee" }], -200)],
  }));
  assert.equal(result.status, "confirmed");
  assert.equal(result.netEarningsCents, 3538);
});

test("a fully refunded charge can have negative retained earnings from Stripe fees", () => {
  const result = reconcileProviderEarnings(payment({ status: "refunded", refundedAmountCents: 8000 }), snapshot({
    refundedAmount: 8000,
    applicationFee: { amount: 400, amountRefunded: 400, currency: "usd" },
    refunds: [refund(8000)],
  }));
  assert.equal(result.status, "confirmed");
  assert.equal(result.platformFeeCents, 0);
  assert.equal(result.netEarningsCents, -262);
});

test("actual Stripe refund-fee credits adjust the retained payment fee", () => {
  const result = reconcileProviderEarnings(payment({ status: "partially_refunded", refundedAmountCents: 4000 }), snapshot({
    refundedAmount: 4000,
    applicationFee: { amount: 400, amountRefunded: 200, currency: "usd" },
    refunds: [refund(4000, [{ amount: -100, currency: "usd", type: "stripe_fee" }], -100)],
  }));
  assert.equal(result.status, "confirmed");
  assert.equal(result.stripeFeeCents, 162);
  assert.equal(result.netEarningsCents, 3638);
});

test("missing async fee records and unsettled payments never invent exact earnings", () => {
  for (const source of [snapshot({ balance: null }), snapshot({ applicationFee: null })]) {
    const result = reconcileProviderEarnings(payment(), source);
    assert.equal(result.status, "pending");
    assert.equal(result.stripeFeeCents, null);
    assert.equal(result.netEarningsCents, null);
  }
  for (const status of ["checkout_pending", "processing", "failed", "expired"]) {
    assert.equal(reconcileProviderEarnings(payment({ status }), snapshot()).status, "pending");
  }
});

test("absence of Stripe fee details is unavailable rather than a guessed zero", () => {
  const result = reconcileProviderEarnings(payment(), snapshot({ balance: {
    amount: 8000, fee: 400, net: 7600, currency: "usd",
    feeDetails: [{ amount: 400, currency: "usd", type: "application_fee" }],
  } }));
  assert.equal(result.status, "unavailable");
  assert.equal(result.netEarningsCents, null);
});

test("foreign currency, unknown fee categories and dispute adjustments do not show misleading net", () => {
  const cases = [
    snapshot({ currency: "eur" }),
    snapshot({ disputed: true }),
    snapshot({ amount: 8001 }),
    snapshot({ balance: { ...snapshot().balance, net: 7339 } }),
    snapshot({ balance: { ...snapshot().balance, feeDetails: [
      { amount: 400, currency: "usd", type: "application_fee" },
      { amount: 262, currency: "usd", type: "unknown_adjustment" },
    ] } }),
  ];
  for (const source of cases) {
    const result = reconcileProviderEarnings(payment(), source);
    assert.equal(result.status, "unavailable");
    assert.equal(result.netEarningsCents, null);
  }
});

test("in-progress, incomplete and out-of-sync refunds keep earnings unresolved", () => {
  const refunded = payment({ status: "partially_refunded", refundedAmountCents: 4000 });
  const source = snapshot({ refundedAmount: 4000, refunds: [refund(4000)] });
  assert.equal(reconcileProviderEarnings(payment(), source).status, "pending");
  assert.equal(reconcileProviderEarnings(refunded, { ...source, refundsComplete: false }).status, "unavailable");
  assert.equal(reconcileProviderEarnings(refunded, { ...source, refunds: [{ ...refund(4000), status: "pending" }] }).status, "pending");
  assert.equal(reconcileProviderEarnings(refunded, { ...source, refunds: [{ ...refund(4000), balance: null }] }).status, "pending");
});

test("a failed refund with ledger entries is not mistaken for an adjustment-free payment", () => {
  const failed = { ...refund(4000), status: "failed" };
  assert.equal(reconcileProviderEarnings(payment(), snapshot({ refunds: [failed] })).status, "unavailable");
  assert.equal(reconcileProviderEarnings(payment(), snapshot({ refunds: [{ ...failed, balance: null }] })).status, "confirmed");
});
