import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as stripeStatus from "../src/lib/payments/stripe-setup-status.ts";

const css = new Proxy({}, { get: (_target, key) => String(key) });
function load(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const Link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
const noAction = async () => { throw new Error("Rendering must not run an action"); };

const { ProviderStripeSetupCard } = load("../src/components/payments/provider-stripe-setup-card.tsx", {
  react: React, "react/jsx-runtime": jsxRuntime, "next/link": { default: Link },
  "@/lib/payments/actions": { startStripeOnboarding: noAction },
  "@/lib/payments/types": { initialPaymentActionState: {} },
  "@/lib/payments/stripe-setup-status": stripeStatus,
  "./payment-feedback": { PaymentFeedback: () => null },
  "./provider-stripe-setup-card.module.css": { default: css },
});
const setup = { configured: true, migrationInstalled: true, hasAccount: false, detailsSubmitted: false, requirementsDueCount: 0, paymentsEnabled: false, payoutsEnabled: false, ready: false };
const stripeCard = (providerStatus, changes = {}) => renderToStaticMarkup(React.createElement(ProviderStripeSetupCard, { providerStatus, setup: { ...setup, ...changes } }));

test("only approved providers can start or continue Stripe onboarding", () => {
  assert.match(stripeCard("approved"), /Connect with Stripe/);
  for (const providerStatus of ["pending", "rejected", "suspended", "not_applicable"]) {
    const html = stripeCard(providerStatus);
    assert.doesNotMatch(html, /<form\b|Connect with Stripe/);
    assert.match(html, /Approval required/);
    assert.match(html, /once Auxillium approves your provider profile/);
    const incomplete = stripeCard(providerStatus, { hasAccount: true, status: "incomplete" });
    assert.doesNotMatch(incomplete, /<form\b|Continue Stripe setup/);
    assert.match(incomplete, /Contact support/);
  }
  assert.match(stripeCard("approved", { hasAccount: true, status: "incomplete" }), /Continue Stripe setup/);
});

test("existing ready Stripe accounts remain readable without a redundant setup action", () => {
  for (const providerStatus of ["approved", "suspended"]) {
    const html = stripeCard(providerStatus, { hasAccount: true, ready: true, status: "ready" });
    assert.match(html, /Payments ready/);
    assert.match(html, /Stripe connected/);
    assert.doesNotMatch(html, /<form\b|Connect with Stripe|Continue Stripe setup/);
  }
});

function decisionForms({ refundPending = false, localRefundPending = false, refundState = {} } = {}) {
  let call = 0;
  const { AdminCaseDecisionForms } = load("../src/components/cases/admin-case-decision-forms.tsx", {
    react: { ...React, useActionState: () => ++call === 1 ? [refundState, noAction, localRefundPending] : [{}, noAction, false] },
    "react/jsx-runtime": jsxRuntime,
    "@/components/ui/fields": { NumberField: ({ name, defaultValue }) => React.createElement("input", { name, defaultValue }) },
    "@/lib/cases/actions": { denyBookingCase: noAction, refundBookingCase: noAction },
    "@/lib/cases/types": { initialCaseActionState: {} },
    "./case-feedback": { CaseFeedback: () => null },
    "@/components/marketplace/booking-forms.module.css": { default: css },
  });
  return renderToStaticMarkup(React.createElement(AdminCaseDecisionForms, { caseId: "case", requestedRefundCents: 500, remainingRefundCents: 1000, refundPending }));
}
function denialButton(html) {
  const match = html.match(/<button\b([^>]*)>Deny with notes<\/button>/);
  assert.ok(match);
  return match[1];
}

test("denial is unavailable during a recorded, submitted, or newly started refund", () => {
  assert.doesNotMatch(denialButton(decisionForms()), /disabled/);
  for (const state of [{ refundPending: true }, { localRefundPending: true }, { refundState: { status: "success" } }]) {
    const html = decisionForms(state);
    assert.match(denialButton(html), /disabled/);
    assert.match(html, /A refund is being processed/);
  }
  const recordedPending = decisionForms({ refundPending: true });
  assert.match(recordedPending, /Confirm and issue refund/, "Safe refund reconciliation remains available");
});

test("the admin workspace reads pending refunds and fails closed when that status cannot be loaded", async () => {
  let pendingRows = [{ case_id: "case" }];
  let pendingError = null;
  const queried = [];
  const values = {
    booking_cases: [{ id: "case", payment_id: "payment", booking_id: "booking" }],
    payment_disputes: [],
    booking_payments: [{ id: "payment", booking_id: "booking", status: "paid" }],
    booking_requests: [{ id: "booking", customer_name: "Customer", provider_name: "Provider", service_name: "Visit" }],
  };
  const supabase = { from: (table) => {
    const query = { select() { return query; }, order() { return query; }, in(column, items) { queried.push({ table, column, items }); return query; },
      then(resolve) { return Promise.resolve({ data: table === "booking_refunds" ? pendingRows : values[table], error: table === "booking_refunds" ? pendingError : null }).then(resolve); } };
    return query;
  } };
  const { getAdminResolutionWorkspace } = load("../src/lib/cases/data.ts", {
    "server-only": {}, "next/navigation": { redirect: () => { throw new Error("Unexpected redirect"); } },
    "@/lib/auth/profile": { requireRole: async (role) => { assert.equal(role, "admin"); return { id: "admin" }; } },
    "@/lib/supabase/server": { createClient: async () => supabase },
  });
  assert.equal((await getAdminResolutionWorkspace()).cases[0].refundPending, true);
  assert.ok(queried.some((q) => q.table === "booking_refunds" && q.column === "status" && q.items.join() === "pending,requires_action"));
  pendingRows = [];
  assert.equal((await getAdminResolutionWorkspace()).cases[0].refundPending, false);
  pendingError = { message: "Unavailable" };
  await assert.rejects(getAdminResolutionWorkspace(), /Unable to load resolution refund records/);
});
