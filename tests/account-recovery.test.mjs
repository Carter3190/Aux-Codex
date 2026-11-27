import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { safeDashboardReturnPath } from "../src/lib/auth/return-path.ts";

function setup({ profile = null, configured = true, throws = false } = {}) {
  const loaded = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL("../src/app/setup/page.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const dependencies = {
    "react/jsx-runtime": jsx,
    "next/link": { default: ({ children, href, ...props }) => React.createElement("a", { href, ...props }, children) },
    "@/lib/supabase/config": { isSupabaseConfigured: () => configured },
    "@/lib/auth/profile": { getOptionalCurrentProfile: async () => { if (throws) throw Error("private database diagnostics"); return profile; } },
    "@/lib/auth/return-path": { safeDashboardReturnPath },
    "@/components/recovery/recovery-pages.module.css": { default: new Proxy({}, { get: (_, key) => key }) },
  };
  new Function("require", "module", "exports", compiled)((name) => { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; }, loaded, loaded.exports);
  return async (query) => renderToStaticMarkup(await loaded.exports.default({ searchParams: Promise.resolve(query) }));
}

test("ordinary users receive account recovery rather than developer diagnostics", async () => {
  const previous = process.env.NODE_ENV; process.env.NODE_ENV = "production";
  try {
    const path = "/dashboard/customer/bookings/50000000-0000-4000-8000-000000000001?tab=payment";
    for (const scenario of [{}, { profile: { role: "customer" } }, { profile: { role: "provider" } }, { throws: true }]) {
      const html = await setup(scenario)({ reason: "profile", next: path });
      assert.match(html, /Your account is temporarily unavailable/);
      assert.ok(html.includes(`href="${path}"`)); assert.match(html, /Contact support/);
      assert.doesNotMatch(html, /\.env|Supabase|migrations|private database diagnostics|Developer setup/);
    }
    const unsafe = await setup()({ reason: "profile", next: "//outside.test" });
    assert.ok(unsafe.includes('href="/dashboard"'));
    const unavailable = await setup({ configured: false })({ reason: "stripe-payments" });
    assert.match(unavailable, /temporarily unavailable/); assert.doesNotMatch(unavailable, /STRIPE_SECRET_KEY/);
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test("verified administrators retain technical setup diagnostics", async () => {
  const previous = process.env.NODE_ENV; process.env.NODE_ENV = "production";
  try {
    const html = await setup({ profile: { role: "admin" } })({ reason: "stripe-payments" });
    assert.match(html, /Developer setup/); assert.match(html, /STRIPE_SECRET_KEY/);
    assert.doesNotMatch(html, /private database diagnostics/);
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});
