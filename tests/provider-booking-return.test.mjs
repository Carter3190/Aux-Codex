import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import * as returns from "../src/lib/auth/return-path.ts";
import { getRequiredLegalAgreements } from "../src/lib/legal/agreements.ts";

const providerId = "50000000-0000-4000-8000-000000000003";
const requestPath = `/dashboard/customer/request/${providerId}`;
class Redirect extends Error { constructor(path) { super("redirect"); this.path = path; } }
const css = { default: new Proxy({}, { get: (_, key) => key }) };
const link = { default: ({ children, href, ...props }) => React.createElement("a", { href, ...props }, children) };
function load(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loaded = { exports: {} };
  const common = {
    "react/jsx-runtime": jsx, "next/link": link,
    "next/navigation": { redirect: (path) => { throw new Redirect(path); }, notFound: () => { throw new Error("not found"); } },
    "@/lib/auth/return-path": returns, "./return-path": returns,
  };
  new Function("require", "module", "exports", compiled)((name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (Object.hasOwn(common, name)) return common[name];
    if (name.endsWith(".module.css")) return css;
    throw new Error(`Unexpected dependency ${name}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

test("booking return intent contains only a validated public provider ID", () => {
  assert.equal(returns.providerBookingReturnPath(providerId.toUpperCase()), requestPath);
  assert.equal(returns.bookingProviderIdFromReturnPath(requestPath), providerId);
  for (const value of [null, "", [], "//outside.test", "https://outside.test", "../admin", providerId + "/../admin", "%2f" + providerId]) {
    assert.equal(returns.providerBookingReturnPath(value), null);
  }
  for (const value of ["/dashboard/admin", requestPath + "?next=//outside.test", requestPath + "/../admin", requestPath + "#x", [requestPath]]) {
    assert.equal(returns.bookingProviderIdFromReturnPath(value), null);
  }
  assert.equal(returns.safeDashboardReturnPath(requestPath), requestPath);
  assert.equal(returns.safeDashboardReturnPath(`/providers/${providerId}`), null);
});

function signup({ session = null } = {}) {
  const calls = [], cleanups = [];
  const actions = load("../src/lib/auth/actions.ts", {
    "next/cache": { revalidatePath: () => {} }, zod: { z },
    "@/lib/supabase/config": { isSupabaseConfigured: () => true },
    "@/lib/supabase/server": { createClient: async () => ({ auth: {
      signUp: async (input) => { calls.push(input); return { data: { session }, error: null }; },
      updateUser: async (input) => { cleanups.push(input); return { error: null }; },
    } }) },
    "@/lib/legal/agreements": { getRequiredLegalAgreements },
  });
  return { signUp: actions.signUp, calls, cleanups };
}
function signupForm(role = "customer", next = requestPath) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ fullName: "Test Customer", email: "customer@example.test", password: "example-password-42", role, terms: "accepted", next })) form.set(key, value);
  return form;
}

test("new-customer signup preserves booking intent for confirmation without changing legal acceptance", async () => {
  const flow = signup();
  await assert.rejects(flow.signUp({}, signupForm()), (error) => error instanceof Redirect && error.path === "/auth/check-email");
  const metadata = flow.calls[0].options.data;
  assert.equal(metadata.booking_provider_id, providerId);
  assert.equal(metadata.requested_role, "customer");
  assert.equal(metadata.full_name, "Test Customer");
  assert.deepEqual(metadata.accepted_legal_versions, Object.fromEntries(getRequiredLegalAgreements("customer").map((item) => [item.key, item.version])));
  assert.equal(flow.cleanups.length, 0);
  const rejected = signup();
  const missingTerms = signupForm(); missingTerms.delete("terms");
  const result = await rejected.signUp({}, missingTerms);
  assert.ok(result.fieldErrors.terms); assert.equal(rejected.calls.length, 0);
});

test("instant signup resumes the same booking, while provider and untrusted inputs do not set booking metadata", async () => {
  const flow = signup({ session: { access_token: "test-session" } });
  await assert.rejects(flow.signUp({}, signupForm()), (error) => error.path === requestPath);
  assert.deepEqual(flow.cleanups, [{ data: { booking_provider_id: null } }]);
  for (const [role, next] of [["provider", requestPath], ["customer", "//outside.test"], ["customer", "/dashboard/admin"]]) {
    const other = signup();
    await assert.rejects(other.signUp({}, signupForm(role, next)), (error) => error.path === "/auth/check-email");
    assert.equal(Object.hasOwn(other.calls[0].options.data, "booking_provider_id"), false);
  }
});

function confirmation({ id = providerId, error = null, cleanupFails = false } = {}) {
  const cleanups = [], verifications = [];
  const route = load("../src/app/auth/confirm/route.ts", {
    "next/server": { NextResponse: { redirect: (url) => new Response(null, { status: 307, headers: { Location: url.toString() } }) } },
    "@/lib/supabase/config": { isSupabaseConfigured: () => true },
    "@/lib/supabase/server": { createClient: async () => ({ auth: {
      verifyOtp: async (input) => { verifications.push(input); return { data: { user: { user_metadata: { booking_provider_id: id } } }, error }; },
      updateUser: async (input) => { cleanups.push(input); if (cleanupFails) throw new Error("temporary cleanup failure"); return { error: null }; },
    } }) },
  });
  const request = (next = "/dashboard", type = "email") => {
    const url = new URL("https://app.theauxillium.com/auth/confirm");
    url.searchParams.set("token_hash", "fictional-token"); url.searchParams.set("type", type); url.searchParams.set("next", next);
    return { url: url.toString(), nextUrl: url };
  };
  return { get: (next, type) => route.GET(request(next, type)), cleanups, verifications };
}

test("successful email confirmation resumes the selected provider on another device through the guarded booking bridge", async () => {
  const flow = confirmation();
  const response = await flow.get();
  assert.equal(response.headers.get("Location"), `https://app.theauxillium.com${requestPath}`);
  assert.match(response.headers.get("Cache-Control"), /private.*no-store/);
  assert.deepEqual(flow.verifications, [{ token_hash: "fictional-token", type: "email" }]);
  assert.deepEqual(flow.cleanups, [{ data: { booking_provider_id: null } }]);
  const bridge = load("../src/app/dashboard/customer/request/[providerId]/page.tsx", {
    "@/lib/auth/profile": { requireRole: async (role) => { assert.equal(role, "customer"); } },
  }).default;
  await assert.rejects(bridge({ params: Promise.resolve({ providerId }) }), (error) => error.path === `/providers/${providerId}#request-booking`);
  await assert.rejects(bridge({ params: Promise.resolve({ providerId: "../admin" }) }), /not found/);
});

test("confirmation cannot turn untrusted metadata into an open redirect or bypass an unsuccessful verification", async () => {
  for (const id of ["//outside.test", "https://outside.test", "../admin", null]) {
    const flow = confirmation({ id });
    for (const next of ["//outside.test", "/\\outside.test", "/dashboard/../login", "/dashboard/%5c%5coutside.test"]) {
      assert.equal((await flow.get(next)).headers.get("Location"), "https://app.theauxillium.com/dashboard");
    }
    assert.equal(flow.cleanups.length, 0);
  }
  const failed = confirmation({ error: { message: "fictional invalid token" } });
  assert.equal((await failed.get()).headers.get("Location"), "https://app.theauxillium.com/auth/error");
  assert.equal(failed.cleanups.length, 0);
  const cleanupFailure = confirmation({ cleanupFails: true });
  assert.equal((await cleanupFailure.get()).headers.get("Location"), `https://app.theauxillium.com${requestPath}`);
  const explicit = confirmation();
  assert.equal((await explicit.get("/dashboard/customer/bookings")).headers.get("Location"), "https://app.theauxillium.com/dashboard/customer/bookings");
  const recovery = confirmation();
  assert.equal((await recovery.get("/dashboard", "recovery")).headers.get("Location"), "https://app.theauxillium.com/dashboard");
  assert.equal(recovery.cleanups.length, 0);
});

test("customer signup and its existing-account link retain the trusted booking destination", async () => {
  let props;
  const page = load("../src/app/(auth)/signup/page.tsx", {
    "@/components/auth/signup-form": { SignupForm: (input) => { props = input; return React.createElement("div"); } },
    "@/lib/auth/profile": { getOptionalCurrentProfile: async () => null, getRoleDashboardPath: (role) => `/dashboard/${role}` },
  }).default;
  renderToStaticMarkup(await page({ searchParams: Promise.resolve({ role: "customer", next: requestPath }) }));
  assert.deepEqual(props, { defaultRole: "customer", nextPath: requestPath });
  const form = load("../src/components/auth/signup-form.tsx", {
    react: { useActionState: () => [{}, () => {}, false], useState: (value) => [value, () => {}] },
    "@/lib/auth/actions": { signUp: () => {} }, "@/lib/auth/types": { initialAuthState: {} },
  }).SignupForm;
  const customer = renderToStaticMarkup(React.createElement(form, props));
  assert.ok(customer.includes(`name="next" value="${requestPath}"`));
  assert.ok(customer.includes(`/login?next=${encodeURIComponent(requestPath)}`));
  const provider = renderToStaticMarkup(React.createElement(form, { ...props, defaultRole: "provider" }));
  assert.ok(!provider.includes('name="next"'));
  assert.ok(provider.includes(`/login?next=${encodeURIComponent("/dashboard/provider/application")}`));
});

test("the public provider profile and login account-creation link preserve the same request destination", async () => {
  const provider = {
    providerId, displayName: "Sample Provider", headline: "A professional introduction", bio: "An example provider biography.",
    serviceArea: "Test area", yearsExperience: 5, travelRadiusMiles: 20, services: [], bookableServices: [],
    serviceChecks: [], availability: [], photos: [], bookingEligible: true, averageRating: null, reviewCount: 0, reviews: [],
  };
  const profilePage = load("../src/app/providers/[providerId]/page.tsx", {
    zod: { z },
    "@/components/marketplace/booking-request-form": { BookingRequestForm: () => null },
    "@/components/marketplace/marketplace-header": { MarketplaceHeader: () => null },
    "@/lib/auth/profile": { getOptionalCurrentProfile: async () => null },
    "@/lib/auth/access": { hasCustomerAccess: () => false },
    "@/lib/legal/data": { getLegalAcceptanceStatus: () => { throw Error("Anonymous page cannot record legal review"); } },
    "@/lib/marketplace/data": { getApprovedProvider: async () => provider },
    "@/lib/providers/presentation": { formatPrice: () => "", weekdays: [] },
  }).default;
  const html = renderToStaticMarkup(await profilePage({ params: Promise.resolve({ providerId }) }));
  assert.ok(html.includes(`href="/login?next=${encodeURIComponent(requestPath)}"`));
  assert.ok(html.includes(`href="/signup?role=customer&amp;next=${encodeURIComponent(requestPath)}"`));
  assert.ok(html.includes('id="request-booking"'));
  const loginPage = load("../src/app/(auth)/login/page.tsx", {
    "@/components/auth/login-form": { LoginForm: () => null },
    "@/lib/auth/profile": { getOptionalCurrentProfile: async () => null, getRoleDashboardPath: (role) => `/dashboard/${role}` },
  }).default;
  const login = renderToStaticMarkup(await loginPage({ searchParams: Promise.resolve({ next: requestPath }) }));
  assert.ok(login.includes(`/signup?role=customer&amp;next=${encodeURIComponent(requestPath)}`));
});
