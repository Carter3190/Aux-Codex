import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { LEGAL_AGREEMENTS } from "../src/lib/legal/agreements.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

test("current brand-spelling legal versions bind to the exact published page source", () => {
  const registry = source("supabase/migrations/20261117000000_auxillium_brand_spelling.sql");
  const priorRegistry = [
    "20261026000000_versioned_legal_acceptances.sql",
    "20261106020000_service_credential_policy_versions.sql",
    "20261111010000_post_service_policy_versions.sql",
  ].map((name) => source(`supabase/migrations/${name}`)).join("\n");
  for (const agreement of Object.values(LEGAL_AGREEMENTS)) {
    assert.equal(agreement.version, "2026-11-17");
    const page = source(`src/app${agreement.href}/page.tsx`);
    const digest = createHash("sha256").update(page).digest("hex");
    assert.ok(registry.includes(digest), `${agreement.title} must match the new published digest`);
    const previousDigest = createHash("sha256").update(page.replaceAll("Auxillium", "Auxilium")).digest("hex");
    assert.ok(priorRegistry.includes(previousDigest), `${agreement.title} changes only the brand spelling`);
  }
});

test("new booking acknowledgement keeps provider responsibility and private version binding", () => {
  const form = source("src/components/marketplace/booking-request-form.tsx");
  assert.match(form, /not Auxillium/);
  assert.match(form, /name="providerResponsibilityAcknowledged"[\s\S]*?required/);
  assert.match(form, /Auxillium’s current\{/);
  assert.doesNotMatch(form, /version \$\{|current Terms of Service/);
  const action = source("src/lib/marketplace/actions.ts");
  assert.match(action, /accepted_terms_version: CURRENT_TERMS_VERSION/);
  const registry = source("supabase/migrations/20261117000000_auxillium_brand_spelling.sql");
  assert.match(registry, /booking.provider_name/);
  assert.doesNotMatch(registry, /(?:update|delete from) public\.legal_acceptances/i);
});
