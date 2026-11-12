import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { LEGAL_AGREEMENTS } from "../src/lib/legal/agreements.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

test("published payment terms versions bind to the exact reviewed page source", () => {
  const registry = source("supabase/migrations/20261111010000_post_service_policy_versions.sql");
  for (const agreement of [LEGAL_AGREEMENTS.terms, LEGAL_AGREEMENTS.providerAgreement]) {
    assert.equal(agreement.version, "2026-11-11");
    const page = source(`src/app${agreement.href}/page.tsx`);
    const digest = createHash("sha256").update(page).digest("hex");
    assert.ok(registry.includes(digest), `${agreement.title} must match the published digest`);
  }
  assert.equal(LEGAL_AGREEMENTS.privacy.version, "2026-10-26");
  assert.equal(LEGAL_AGREEMENTS.providerStandards.version, "2026-11-05");
});

test("new booking acknowledgement keeps provider responsibility and private version binding", () => {
  const form = source("src/components/marketplace/booking-request-form.tsx");
  assert.match(form, /not Auxilium/);
  assert.match(form, /name="providerResponsibilityAcknowledged"[\s\S]*?required/);
  assert.match(form, /Auxilium’s current\{/);
  assert.doesNotMatch(form, /version \$\{|current Terms of Service/);
  const action = source("src/lib/marketplace/actions.ts");
  assert.match(action, /accepted_terms_version: CURRENT_TERMS_VERSION/);
  const registry = source("supabase/migrations/20261111010000_post_service_policy_versions.sql");
  assert.match(registry, /booking.provider_name/);
  assert.doesNotMatch(registry, /(?:update|delete from) public\.legal_acceptances/i);
});
