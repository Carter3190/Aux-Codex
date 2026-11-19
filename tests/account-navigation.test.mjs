import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { accountNavigationHeaders, accountNavigationState } from "../src/lib/auth/account-navigation.ts";

test("account navigation exposes only initials and a fixed dashboard destination", () => {
  for (const role of ["customer", "provider", "admin"]) {
    const state = accountNavigationState({ role, fullName: "  Alex Taylor Morgan  ", email: "private@example.test", id: "private-id" });
    assert.deepEqual(state, { account: { initials: "AM", photoUrl: null, href: `/dashboard/${role}` }, showOfferServices: role !== "provider" });
  }
  assert.deepEqual(accountNavigationState(null), { account: null, showOfferServices: true });
  assert.equal(accountNavigationState({ role: "customer", fullName: "Élodie" }).account.initials, "É");
  assert.equal(accountNavigationState({ role: "customer", fullName: "  " }).account.initials, "A");
});

test("cross-site account reads are restricted to exact Auxillium origins and never cached", () => {
  for (const origin of ["https://theauxillium.com", "https://www.theauxillium.com", "https://app.theauxillium.com", null]) {
    const headers = accountNavigationHeaders(origin);
    assert.match(headers.get("Cache-Control"), /private.*no-store/);
    assert.equal(headers.get("Vary"), "Origin, Cookie");
    assert.equal(headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(headers.get("Access-Control-Allow-Credentials"), origin ? "true" : null);
  }
  for (const origin of ["null", "https://outside.test", "https://theauxillium.com.outside.test", "http://theauxillium.com", "https://preview.theauxillium.com"]) {
    assert.equal(accountNavigationHeaders(origin), null);
  }
});

test("untrusted navigation API reads never look up the current session", async () => {
  const source = readFileSync(new URL("../src/app/api/account/navigation/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  let lookups = 0;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => name === "@/lib/auth/profile"
    ? { getOptionalCurrentProfile: async () => { lookups++; return { role: "customer", fullName: "Alex Morgan" }; } }
    : { accountNavigationHeaders, accountNavigationState }, loaded, loaded.exports);
  const request = (origin) => new Request("https://app.theauxillium.com/api/account/navigation", { headers: { origin } });
  assert.equal((await loaded.exports.GET(request("https://outside.test"))).status, 403);
  assert.equal(lookups, 0);
  const response = await loaded.exports.GET(request("https://theauxillium.com"));
  assert.equal(response.status, 200);
  assert.equal(lookups, 1);
  assert.deepEqual(await response.json(), { account: { initials: "AM", photoUrl: null, href: "/dashboard/customer" }, showOfferServices: true });
  assert.equal(loaded.exports.OPTIONS(request("https://theauxillium.com")).status, 204);
  assert.equal(lookups, 1);
});
