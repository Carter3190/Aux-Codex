import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { z } from "zod";
import { safeDashboardReturnPath } from "../src/lib/auth/return-path.ts";

const bookingPath = "/dashboard/customer/bookings/22222222-2222-4222-8222-222222222222?tab=overview";
class Redirect extends Error { constructor(path) { super("redirect"); this.path = path; } }
function load(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

test("sign-in return paths reject open redirects, control characters and auth loops", () => {
  assert.equal(safeDashboardReturnPath(bookingPath), bookingPath);
  assert.equal(safeDashboardReturnPath("/dashboard/customer/bookings?filter=paid"), "/dashboard/customer/bookings?filter=paid");
  for (const unsafe of [undefined, null, [bookingPath], "https://outside.test", "//outside.test", "/\\outside.test", "/dashboardevil", "/login", "/dashboard/../login", "/dashboard/%2e%2e/login", "/dashboard/%5cfoo", "/dashboard/%0d%0afoo", "/dashboard/a\nfoo", "/dashboard/a\u0000foo", "/dashboard/with space", "/dashboard/%ZZ"]) {
    assert.equal(safeDashboardReturnPath(unsafe), null, JSON.stringify(unsafe));
  }
});

function signInAction() {
  const signIns = [], invalidations = [];
  const actions = load("../src/lib/auth/actions.ts", {
    "next/cache": { revalidatePath: (...args) => invalidations.push(args) },
    "next/navigation": { redirect: (path) => { throw new Redirect(path); } },
    zod: { z },
    "@/lib/supabase/config": { isSupabaseConfigured: () => true },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { signInWithPassword: async (input) => { signIns.push(input); return { error: null }; } } }) },
    "@/lib/legal/agreements": {}, "./return-path": { safeDashboardReturnPath },
  });
  return { signIn: actions.signIn, signIns, invalidations };
}

test("successful sign-in returns to the completed booking; ordinary sign-in keeps its dashboard destination", async () => {
  for (const [next, expected] of [[bookingPath, bookingPath], [undefined, "/dashboard"], ["//outside.test", "/dashboard"]]) {
    const { signIn, signIns, invalidations } = signInAction();
    const form = new FormData(); form.set("email", "alex@example.test"); form.set("password", "not-a-real-password");
    if (next) form.set("next", next);
    await assert.rejects(signIn({}, form), (error) => error instanceof Redirect && error.path === expected);
    assert.deepEqual(signIns, [{ email: "alex@example.test", password: "not-a-real-password" }]);
    assert.deepEqual(invalidations, [["/", "layout"]]);
  }
});

test("signed-out dashboard access carries its trusted return path to the sign-in page", async () => {
  for (const [requestPath, expected] of [[bookingPath, `/login?next=${encodeURIComponent(bookingPath)}`], ["//outside.test", "/login"], [null, "/login"]]) {
    const profile = load("../src/lib/auth/profile.ts", {
      react: { cache: (fn) => fn },
      "next/headers": { headers: async () => ({ get: () => requestPath }) },
      "next/navigation": { redirect: (path) => { throw new Redirect(path); } },
      "@/lib/supabase/config": { isSupabaseConfigured: () => true },
      "@/lib/supabase/server": { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: null }, error: null }) } }) },
      "./return-path": { safeDashboardReturnPath },
    });
    await assert.rejects(profile.getCurrentProfile(), (error) => error instanceof Redirect && error.path === expected);
  }
});

test("the booking destination still passes through current legal acceptance requirements", async () => {
  const child = { booking: "private booking content" };
  for (const missing of [[], [{ key: "terms" }]]) {
    const layout = load("../src/app/dashboard/layout.tsx", {
      "next/headers": { headers: async () => ({ get: () => bookingPath }) },
      "next/navigation": { redirect: (path) => { throw new Redirect(path); } },
      "@/lib/auth/profile": { getCurrentProfile: async () => ({ id: "customer", role: "customer" }) },
      "@/lib/legal/data": { getLegalAcceptanceStatus: async () => ({ migrationReady: true, missing }) },
    }).default;
    if (missing.length) await assert.rejects(layout({ children: child }), (error) => error instanceof Redirect && error.path === `/legal/accept?next=${encodeURIComponent(bookingPath)}`);
    else assert.equal(await layout({ children: child }), child);
  }
});
