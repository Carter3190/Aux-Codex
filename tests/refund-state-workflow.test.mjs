import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import ts from "typescript";
import * as refundStatus from "../src/lib/cases/refund-status.ts";

const caseId = "11111111-1111-4111-8111-111111111111";
const refundId = "22222222-2222-4222-8222-222222222222";
const bookingId = "33333333-3333-4333-8333-333333333333";
const paymentId = "44444444-4444-4444-8444-444444444444";
const css = new Proxy({}, { get: (_target, key) => String(key) });
function load(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", "console", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, compiledModule, compiledModule.exports, { error() {} });
  return compiledModule.exports;
}
const forbiddenAction = () => assert.fail("Rendering must not invoke financial actions");
function formHtml({ pendingRefund = null, remaining = 12500, refundPending = Boolean(pendingRefund) } = {}) {
  const { AdminCaseDecisionForms } = load("../src/components/cases/admin-case-decision-forms.tsx", {
    react: { ...React, useActionState: () => [{}, forbiddenAction, false] },
    "react/jsx-runtime": jsxRuntime,
    "@/components/ui/fields": { NumberField: (props) => React.createElement("input", { name: props.name, defaultValue: props.defaultValue }) },
    "@/lib/cases/actions": { denyBookingCase: forbiddenAction, refundBookingCase: forbiddenAction },
    "@/lib/cases/types": { initialCaseActionState: {} },
    "./case-feedback": { CaseFeedback: () => null },
    "@/components/marketplace/booking-forms.module.css": { default: css },
  });
  return renderToStaticMarkup(React.createElement(AdminCaseDecisionForms, {
    caseId, requestedRefundCents: 12500, remainingRefundCents: remaining, refundPending,
    pendingRefund, decisionNotes: "Refund only the agreed partial amount.",
  }));
}
const existing = { id: refundId, amountCents: 5000, status: "pending", stripeRefundId: "re_existing", createdAt: "2026-01-01T00:00:00Z", canRetry: true };

test("a pending $50 partial refund never defaults to the customer's original $125 request", () => {
  const html = formHtml({ pendingRefund: existing });
  const amountInput = html.match(/<input[^>]*name="amount"[^>]*>/)?.[0] ?? "";
  assert.match(amountInput, /readOnly=""/);
  assert.match(amountInput, /value="50\.00"/);
  assert.doesNotMatch(html, /value="125\.00"/);
  assert.match(html, /Check refund status/);
  assert.match(html, /The amount is locked/);
  assert.match(html, /name="notes"[^>]*readOnly/);
  assert.match(html, /disabled=""[^>]*>Deny with notes/);
  assert.doesNotMatch(html, /immediately creates a Stripe refund/);
  assert.match(formHtml(), /value="125\.00"/);
  assert.match(formHtml(), /Confirm and issue refund/);
});

test("known Stripe refunds remain checkable even when the refundable balance changed; uncertain old intents cannot be replayed", () => {
  const known = formHtml({ pendingRefund: existing, remaining: 0 });
  assert.doesNotMatch(known.match(/<button[^>]*>Check refund status<\/button>/)?.[0] ?? "", /disabled/);
  const unknown = formHtml({ pendingRefund: { ...existing, stripeRefundId: null, canRetry: false } });
  assert.match(unknown, /status review in Stripe/);
  assert.match(unknown, /disabled=""[^>]*>Retry existing refund/);
  const now = Date.parse("2026-11-27T12:00:00Z");
  assert.equal(refundStatus.canRetryBookingRefund({ stripeRefundId: "re_known", createdAt: "2020-01-01" }, now), true);
  assert.equal(refundStatus.canRetryBookingRefund({ stripeRefundId: null, createdAt: "2026-11-27T11:59:00Z" }, now), true);
  assert.equal(refundStatus.canRetryBookingRefund({ stripeRefundId: null, createdAt: "2026-11-26T12:00:00Z" }, now), false);
  assert.equal(refundStatus.canRetryBookingRefund({ stripeRefundId: null, createdAt: "invalid" }, now), false);
});

function actionHarness({ stripeId = "re_existing", createdAt = "2020-01-01T00:00:00Z", status = "pending", account = "acct_provider", unauthorized = false, recordError = null, recordResult = true } = {}) {
  const calls = [], notices = [], records = [];
  const refund = { id: "re_existing", amount: 5000, currency: "usd", status, charge: "ch_existing", payment_intent: "pi_existing", created: 1700000000 };
  const stripe = {
    refunds: {
      retrieve: async (...args) => { calls.push({ method: "retrieve", args }); return refund; },
      create: async (...args) => { calls.push({ method: "create", args }); return refund; },
    },
    paymentIntents: { retrieve: () => assert.fail("Known charge needs no lookup") },
  };
  const userDb = { rpc: async (name, args) => {
    assert.equal(name, "prepare_booking_case_refund");
    if (args.requested_amount_cents !== 5000) return { error: { message: "A refund for a different amount is already pending. Retry using the pending amount." } };
    return { data: [{ refund_id: refundId, booking_id: bookingId, payment_id: paymentId, stripe_payment_intent_id: "pi_existing", stripe_charge_id: "ch_existing", amount_cents: 5000, remaining_refundable_cents: 12500 }], error: null };
  } };
  const admin = {
    from: (table) => ({ select() { return this; }, eq() { return this; }, single: async () => table === "booking_payments"
      ? { data: { stripe_account_id: account }, error: null }
      : { data: { stripe_refund_id: stripeId, created_at: createdAt }, error: null } }),
    rpc: async (name, args) => { assert.equal(name, "record_booking_refund_state"); records.push(args); return { data: recordResult, error: recordError }; },
  };
  const { refundBookingCase } = load("../src/lib/cases/actions.ts", {
    zod: { z }, "next/cache": { revalidatePath() {} },
    "@/lib/auth/profile": { requireRole: async (role) => { assert.equal(role, "admin"); if (unauthorized) throw new Error("Only admins."); } },
    "@/lib/email/notifications": { notifyBookingParticipants: () => assert.fail("Use recorded status notification"), notifyCaseParticipants() {} },
    "@/lib/marketplace/data": { requireMarketplaceActionRole: forbiddenAction },
    "@/lib/stripe/config": { isStripeServerConfigured: () => true },
    "@/lib/stripe/server": { getStripe: () => stripe },
    "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/supabase/server": { createClient: async () => userDb },
    "./refund-status": refundStatus,
    "./refund-notifications": { notifyRecordedBookingRefund: async (value) => { notices.push(value); } },
  });
  const run = async (amount = "50.00") => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ caseId, amount, notes: "Refund only the agreed partial amount.", confirmation: "confirmed" })) form.set(key, value);
    return refundBookingCase({}, form);
  };
  return { run, calls, notices, records };
}

test("reconciliation reads the existing connected refund instead of creating a second refund", async () => {
  for (const account of ["acct_provider", null]) {
    const harness = actionHarness({ account });
    const result = await harness.run();
    assert.equal(result.status, "success");
    assert.match(result.message, /pending/);
    assert.deepEqual(harness.calls, [{ method: "retrieve", args: account ? ["re_existing", {}, { stripeAccount: account }] : ["re_existing"] }]);
    assert.equal(harness.records[0].refund_amount_cents, 5000);
    assert.deepEqual(harness.notices, [{ refundId }]);
  }
});

test("fresh unlinked intents reuse their original exact idempotency key and account; old or unauthorized attempts fail before Stripe", async () => {
  for (const account of ["acct_provider", null]) {
    const harness = actionHarness({ stripeId: null, createdAt: new Date().toISOString(), account });
    assert.equal((await harness.run()).status, "success");
    assert.equal(harness.calls[0].method, "create");
    assert.equal(harness.calls[0].args[0].amount, 5000);
    assert.equal(harness.calls[0].args[1].idempotencyKey, `auxilium_refund_${refundId}`);
    if (account) assert.equal(harness.calls[0].args[1].stripeAccount, account);
    else assert.equal(harness.calls[0].args[0].reverse_transfer, true);
  }
  for (const changes of [{ stripeId: null }, { unauthorized: true }]) {
    const harness = actionHarness(changes);
    assert.equal((await harness.run()).status, "error");
    assert.deepEqual(harness.calls, []);
  }
  const changedAmount = actionHarness();
  assert.equal((await changedAmount.run("125.00")).status, "error");
  assert.deepEqual(changedAmount.calls, []);
});

test("failed and requires-action refunds never report completion; unrecorded results send no notification", async () => {
  for (const status of ["failed", "canceled"]) {
    const harness = actionHarness({ status });
    const result = await harness.run();
    assert.equal(result.status, "error");
    assert.doesNotMatch(result.message, /refund completed/);
  }
  const attention = await actionHarness({ status: "requires_action" }).run();
  assert.match(attention.message, /additional step/);
  const syncFailed = actionHarness({ recordError: { message: "Offline" } });
  assert.equal((await syncFailed.run()).status, "error");
  assert.deepEqual(syncFailed.notices, []);
});

test("a delayed API response cannot announce stale pending status after the protected ledger rejected it", async () => {
  const harness = actionHarness({ status: "pending", recordResult: false });
  const result = await harness.run();
  assert.equal(result.status, "success");
  assert.match(result.message, /latest recorded refund status/);
  assert.doesNotMatch(result.message, /refund is pending|refund completed/);
  assert.notEqual(result.refundPending, true);
  assert.deepEqual(harness.notices, [{ refundId }], "Notification helper reads the protected ledger, not the stale API response");
});

test("refund emails distinguish each recorded state and use separate pending/success idempotency keys", () => {
  const pending = refundStatus.bookingRefundNotification({ id: refundId, amountCents: 5000, status: "pending" });
  const succeeded = refundStatus.bookingRefundNotification({ id: refundId, amountCents: 5000, status: "succeeded" });
  assert.match(pending.message, /not complete yet/);
  assert.match(succeeded.message, /Stripe confirmed/);
  assert.notEqual(pending.eventKey, succeeded.eventKey);
  for (const status of ["requires_action", "failed", "canceled"]) {
    const content = refundStatus.bookingRefundNotification({ id: refundId, amountCents: 5000, status });
    assert.doesNotMatch(content.message, /Stripe confirmed|was sent back/);
    assert.equal(content.eventKey, `booking_refund_${refundId}_${status}`);
  }
  assert.equal(refundStatus.bookingRefundNotification({ id: refundId, amountCents: 5000, status: "untrusted" }), null);
});

test("refund notification preparation reads recorded ledger state and tolerates unavailable email delivery", async () => {
  let status = "pending", fail = false;
  const notices = [];
  const admin = { from: (table) => ({ select() { return this; }, eq() { return this; }, single: async () => {
    if (fail) throw new Error("Private database details");
    return { data: table === "booking_refunds" ? { id: refundId, payment_id: paymentId, amount_cents: 5000, status } : { booking_id: bookingId }, error: null };
  } }) };
  const { notifyRecordedBookingRefund } = load("../src/lib/cases/refund-notifications.ts", {
    "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/email/notifications": { notifyBookingParticipants: async (notice) => { notices.push(notice); } },
    "./refund-status": refundStatus,
  });
  await notifyRecordedBookingRefund({ refundId });
  status = "succeeded";
  await notifyRecordedBookingRefund({ stripeRefundId: "re_existing" });
  assert.deepEqual(notices.map(({ eventKey }) => eventKey), [`booking_refund_${refundId}_pending`, `booking_refund_${refundId}_succeeded`]);
  assert.ok(notices.every((notice) => notice.bookingId === bookingId && notice.recipients.join() === "customer,provider"));
  fail = true;
  await assert.doesNotReject(notifyRecordedBookingRefund({ refundId }));
  assert.equal(notices.length, 2);
});

function webhookHarness({ recorded = true, recordError = null, notifyFails = false, connectedMatches = true, validSignature = true, previousStatus = "pending" } = {}) {
  const notifications = [], records = [];
  const event = { id: "evt_refund", account: "acct_provider", type: "refund.updated", created: 1700000000,
    data: { previous_attributes: { status: previousStatus }, object: { id: "re_existing", amount: 5000, currency: "usd", status: "succeeded", charge: "ch_existing", payment_intent: "pi_existing", created: 1700000000, metadata: { auxilium_refund_id: refundId } } } };
  const admin = {
    from: () => ({ select() { return this; }, eq() { return this; }, or() { return this; }, maybeSingle: async () => ({ data: connectedMatches ? { id: paymentId } : null, error: null }) }),
    rpc: async (name, args) => { assert.equal(name, "record_booking_refund_event_state"); records.push(args); return { data: recorded, error: recordError }; },
  };
  const { POST } = load("../src/app/api/stripe/webhook/route.ts", {
    "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/stripe/config": { getStripeWebhookSecrets: () => ["test-secret"], isStripeConnectWebhookConfigured: () => true, isStripeWebhookConfigured: () => true },
    "@/lib/stripe/server": { getStripe: () => ({ webhooks: { constructEvent: () => { if (!validSignature) throw new Error("Bad signature"); return event; } } }) },
    "@/lib/cases/refund-notifications": { notifyRecordedBookingRefund: async (value) => { notifications.push(value); if (notifyFails) throw new Error("Email unavailable"); } },
  });
  const run = () => POST(new Request("https://app.theauxillium.com/api/stripe/webhook", { method: "POST", body: "signed event", headers: { "stripe-signature": "test-signature" } }));
  return { run, notifications, records };
}

test("only verified, newly recorded refund events notify; duplicate and mismatched events are harmless", async () => {
  const verified = webhookHarness();
  assert.equal((await verified.run()).status, 200);
  assert.deepEqual(verified.notifications, [{ stripeRefundId: "re_existing" }]);
  assert.equal(verified.records[0].stripe_event_id, "evt_refund");
  assert.equal(verified.records[0].stripe_event_created, 1700000000);
  assert.equal(verified.records[0].stripe_previous_refund_status, "pending");
  const noTrustedStatus = webhookHarness({ previousStatus: true });
  await noTrustedStatus.run();
  assert.equal(noTrustedStatus.records[0].stripe_previous_refund_status, null);
  for (const options of [{ recorded: false }, { connectedMatches: false }, { recordError: { message: "Offline" } }, { validSignature: false }]) {
    const harness = webhookHarness(options);
    await harness.run();
    assert.deepEqual(harness.notifications, []);
  }
  const emailUnavailable = webhookHarness({ notifyFails: true });
  assert.equal((await emailUnavailable.run()).status, 200, "Email errors must not undo successful reconciliation");
});
