import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { z } from "zod";
import * as policy from "../src/lib/providers/service-policy.ts";

const owner = "50000000-0000-4000-8000-000000000003";
const item = "50000000-0000-4000-8000-000000000010";
const originalPath = `${owner}/original.pdf`;
const form = (values) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
function actions({ updateError = null, missing = false, permissionError = false } = {}) {
  const writes = [], reads = [], invalidations = [];
  let authCalls = 0;
  const db = { from(table) {
    const filters = [];
    let values;
    const query = {
      update(value) { values = value; return query; },
      select(columns) { if (!values) reads.push({ table, columns, filters }); return query; },
      eq(column, value) { filters.push([column, value]); return query; },
      async maybeSingle() {
        if (values) {
          writes.push({ table, values, filters });
          return { data: missing ? null : { id: item }, error: updateError };
        }
        return { data: missing ? null : { credential_type: "license", document_path: originalPath }, error: null };
      },
    };
    return query;
  } };
  const dependencies = {
    "next/cache": { revalidatePath: (...args) => invalidations.push(args) },
    zod: { z },
    "@/lib/email/notifications": { notifyProviderApplication: () => assert.fail("Editing must not submit an application or send an email") },
    "@/lib/legal/agreements": { LEGAL_AGREEMENTS: {} },
    "./data": { requireActionRole: async (role) => { authCalls++; assert.equal(role, "provider"); if (permissionError) throw Error("You do not have permission to perform this action."); return { supabase: db, userId: owner }; } },
    "./service-policy": policy,
  };
  const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/providers/actions.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => { assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`); return dependencies[name]; }, loaded, loaded.exports);
  return { ...loaded.exports, writes, reads, invalidations, get authCalls() { return authCalls; } };
}
const service = { serviceId: item, name: "Repair visit", description: "General repairs", pricingType: "fixed", price: "150.25", servicePolicyConfirmation: "accepted" };
const credential = { credentialId: item, title: "Trade license", issuer: "Issuing board", credentialNumber: "LIC123", expiresOn: "" };

test("service edit validates policy and price then updates only the authenticated owner's service", async () => {
  const api = actions();
  assert.equal((await api.updateProviderService({}, form(service))).status, "success");
  assert.deepEqual(api.writes, [{ table: "provider_services", values: { name: "Repair visit", description: "General repairs", pricing_type: "fixed", price_cents: 15025 }, filters: [["id", item], ["provider_id", owner]] }]);
  for (const values of [{ ...service, servicePolicyConfirmation: "" }, { ...service, price: "invalid" }, { ...service, name: "Medical care" }]) {
    const attempt = actions();
    const result = await attempt.updateProviderService({}, form(values));
    assert.ok(result.status === "error");
    assert.equal(attempt.writes.length, 0);
  }
});

test("archive preserves service identity instead of deleting and reports failed/missing writes", async () => {
  for (const isActive of ["false", "true"]) {
    const api = actions();
    const result = await api.setProviderServiceActive({}, form({ serviceId: item, isActive }));
    assert.equal(result.status, "success");
    assert.deepEqual(api.writes[0], { table: "provider_services", values: { is_active: isActive === "true" }, filters: [["id", item], ["provider_id", owner]] });
    assert.match(result.message, isActive === "true" ? /review/ : /Existing bookings and payment records are kept/);
  }
  for (const options of [{ updateError: { message: "private database error" } }, { missing: true }, { permissionError: true }]) {
    const api = actions(options);
    const result = await api.setProviderServiceActive({}, form({ serviceId: item, isActive: "false" }));
    assert.equal(result.status, "error");
    assert.doesNotMatch(result.message, /private database error/);
    assert.equal(api.invalidations.length, 0);
  }
});

test("license issuer is required before any upload registration lookup", async () => {
  const api = actions();
  const result = await api.registerProviderCredential(form({ credentialType: "license", title: "Trade license", issuer: "", credentialNumber: "", expiresOn: "", documentPath: originalPath }));
  assert.equal(result.status, "error");
  assert.match(result.fieldErrors.issuer[0], /organization that issued the license/);
  assert.equal(api.authCalls, 0);
  assert.equal(api.writes.length, 0);
});

test("credential corrections trust the owned saved document/type and cannot write review evidence", async () => {
  const api = actions();
  const result = await api.updateProviderCredentialMetadata({}, form({ ...credential, credentialType: "other", documentPath: "another-owner/replacement.pdf", reviewStatus: "approved", reviewedBy: "forged" }));
  assert.equal(result.status, "success");
  assert.deepEqual(api.reads[0].filters, [["id", item], ["provider_id", owner]]);
  assert.deepEqual(api.writes, [{ table: "provider_credentials", values: { title: "Trade license", issuer: "Issuing board", credential_number: "LIC123", expires_on: null }, filters: [["id", item], ["provider_id", owner]] }]);
  const incomplete = actions();
  const invalid = await incomplete.updateProviderCredentialMetadata({}, form({ ...credential, issuer: "", credentialType: "other" }));
  assert.equal(invalid.status, "error");
  assert.ok(invalid.fieldErrors.issuer);
  assert.equal(incomplete.writes.length, 0);
});
