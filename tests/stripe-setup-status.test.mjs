import assert from "node:assert/strict";
import { test } from "node:test";
import { stripeSetupStatus, providerStripeStatus } from "../src/lib/payments/stripe-setup-status.ts";

const submitted = { details_submitted: true, charges_enabled: false, payouts_enabled: false };
const setup = { configured: true, migrationInstalled: true, hasAccount: true, detailsSubmitted: true, requirementsDueCount: 0, ready: false };

test("Stripe submission alone cannot imply review or payment readiness", () => {
  assert.equal(stripeSetupStatus(submitted).status, "incomplete");
  assert.equal(stripeSetupStatus({ details_submitted: false }).status, "incomplete");
  assert.equal(providerStripeStatus({ ...setup, hasAccount: false }), "not_started");
});

test("Stripe pending signals show review unless there is an outstanding action", () => {
  assert.equal(stripeSetupStatus({ ...submitted, requirements: { pending_verification: ["individual.verification.document"] } }).status, "pending");
  assert.equal(stripeSetupStatus({ ...submitted, capabilities: { card_payments: "pending" } }).status, "pending");
  assert.equal(stripeSetupStatus({ ...submitted, requirements: { disabled_reason: "requirements.pending_verification" } }).status, "pending");
  const mixed = stripeSetupStatus({ ...submitted, requirements: { currently_due: ["external_account", "external_account"], past_due: ["external_account", "business_profile.url"], pending_verification: ["individual.verification.document"] } });
  assert.equal(mixed.status, "action_required");
  assert.equal(mixed.requirementsDueCount, 2);
  assert.equal(mixed.pendingVerificationCount, 1);
  assert.equal(stripeSetupStatus({ ...submitted, requirements: { errors: [{ code: "verification_failed_keyed_identity" }] } }).status, "action_required");
  assert.equal(stripeSetupStatus({ ...submitted, requirements: { disabled_reason: "rejected.fraud" } }).status, "action_required");
});

test("explicit verification failures need action even when onboarding is incomplete", () => {
  const incomplete = { details_submitted: false, charges_enabled: false, payouts_enabled: false };
  assert.equal(stripeSetupStatus({ ...incomplete, requirements: { currently_due: ["external_account"] } }).status, "incomplete");
  assert.equal(stripeSetupStatus({ ...incomplete, requirements: { past_due: ["external_account"] } }).status, "action_required");
  assert.equal(stripeSetupStatus({ ...incomplete, requirements: { errors: [{ code: "verification_document_expired" }] } }).status, "action_required");
  assert.equal(stripeSetupStatus({ ...incomplete, requirements: { disabled_reason: "rejected.other" } }).status, "action_required");
});

test("payment readiness requires submitted details and both enabled flags", () => {
  const ready = { ...submitted, charges_enabled: true, payouts_enabled: true };
  assert.equal(stripeSetupStatus(ready).status, "ready");
  assert.equal(stripeSetupStatus(ready).ready, true);
  assert.equal(stripeSetupStatus({ ...ready, payouts_enabled: false }).ready, false);
  assert.equal(stripeSetupStatus({ ...ready, charges_enabled: false }).ready, false);
  assert.equal(stripeSetupStatus({ ...ready, details_submitted: false }).ready, false);
  const requirements = stripeSetupStatus({ ...ready, requirements: { currently_due: ["individual.id_number"] } });
  assert.equal(requirements.ready, true);
  assert.equal(requirements.status, "action_required");
});

test("stale readiness is never presented as fresh approval", () => {
  assert.equal(providerStripeStatus({ ...setup, ready: true, status: "ready", statusFresh: false }), "unknown");
  assert.equal(providerStripeStatus({ ...setup, status: "pending", statusFresh: false }), "unknown");
  assert.equal(providerStripeStatus({ ...setup, ready: true, statusFresh: true }), "ready");
  assert.equal(providerStripeStatus({ ...setup, hasAccount: false }), "not_started");
  assert.equal(providerStripeStatus({ ...setup, configured: false }), "unavailable");
  assert.equal(providerStripeStatus({ ...setup, migrationInstalled: false }), "unavailable");
});
