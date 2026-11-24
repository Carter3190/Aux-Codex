import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { z } from "zod";
import { hasCustomerAccess, hasProviderAccess } from "../src/lib/auth/access.ts";
import { safeDashboardReturnPath } from "../src/lib/auth/return-path.ts";
import { bookingConversationWritable } from "../src/lib/marketplace/booking-messaging.ts";

class Redirect extends Error {
  constructor(path) { super("redirect"); this.path = path; }
}
const redirect = (path) => { throw new Redirect(path); };
const jsx = (type, props) => ({ type, props });
const styles = new Proxy({}, { get: (_, key) => String(key) });
const memberId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const bookingId = "33333333-3333-4333-8333-333333333333";
const profile = { id: memberId, role: "provider", primaryRole: "provider", customerAccess: true, fullName: "Member", providerStatus: "pending" };

function load(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

function elements(node, predicate) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => elements(child, predicate));
  return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)];
}

function database({ rows = {}, claims = { sub: memberId, email: "member@example.test" }, claimsError = null } = {}) {
  const calls = [];
  return {
    calls,
    auth: { getClaims: async () => ({ data: { claims }, error: claimsError }) },
    from(table) {
      calls.push([table, "from"]);
      const result = () => ({ data: rows[table] ?? [], error: null });
      const query = {};
      for (const method of ["select", "eq", "or", "in", "order", "limit"]) {
        query[method] = (...args) => { calls.push([table, method, ...args]); return query; };
      }
      for (const method of ["single", "maybeSingle"]) {
        query[method] = async () => { calls.push([table, method]); return result(); };
      }
      query.then = (resolve, reject) => Promise.resolve(result()).then(resolve, reject);
      return query;
    },
  };
}

function loadProfile(db, configured = true) {
  return load("../src/lib/auth/profile.ts", {
    react: { cache: (fn) => fn },
    "next/headers": { headers: async () => ({ get: () => "/dashboard/customer/bookings" }) },
    "next/navigation": { redirect },
    "@/lib/supabase/config": { isSupabaseConfigured: () => configured },
    "@/lib/supabase/server": { createClient: async () => db },
    "./return-path": { safeDashboardReturnPath },
    "./access": { hasCustomerAccess },
  });
}

function profileRow(role, customerAccess = false) {
  return { id: memberId, full_name: "Member", role, customer_access: customerAccess, provider_status: "pending", created_at: "2026-11-23T00:00:00Z" };
}

test("enrolled customers retain the customer workspace while their primary provider identity survives", async () => {
  const db = database({ rows: { profiles: profileRow("provider", true) } });
  const auth = loadProfile(db);
  const current = await auth.getCurrentProfile();
  assert.equal(current.role, "provider");
  assert.equal(current.primaryRole, "provider");
  assert.equal(current.customerAccess, true);
  const customer = await auth.requireRole("customer");
  assert.equal(customer.role, "customer");
  assert.equal(customer.primaryRole, "provider");
  assert.equal(customer.id, memberId);
  assert.equal(hasCustomerAccess(customer), true);
  assert.equal(hasProviderAccess(customer), true);
  assert.equal((await auth.requireRole("provider")).role, "provider");
  assert.equal((await auth.getOptionalCurrentProfile()).customerAccess, true);
  assert.ok(db.calls.filter((call) => call[1] === "eq").every((call) => call[2] === "id" && call[3] === memberId));
});

test("customer access is explicit and does not grant another account role", async () => {
  for (const [role, requested, expected] of [["provider", "customer", "/dashboard/provider"], ["customer", "provider", "/dashboard/customer"], ["admin", "provider", "/dashboard/admin"]]) {
    const auth = loadProfile(database({ rows: { profiles: profileRow(role) } }));
    await assert.rejects(auth.requireRole(requested), (error) => error instanceof Redirect && error.path === expected);
  }
  const customer = await loadProfile(database({ rows: { profiles: profileRow("customer") } })).requireRole("customer");
  assert.equal(customer.customerAccess, true);
  assert.equal(customer.primaryRole, "customer");
  assert.equal(hasProviderAccess(customer), false);
  assert.equal(await loadProfile(database(), false).getOptionalCurrentProfile(), null);
  const anonymous = loadProfile(database({ claims: null }));
  assert.equal(await anonymous.getOptionalCurrentProfile(), null);
  await assert.rejects(anonymous.getCurrentProfile(), (error) => error instanceof Redirect && error.path === "/login?next=%2Fdashboard%2Fcustomer%2Fbookings");
});

function enrollment(member, error = null) {
  const calls = [];
  const action = load("../src/lib/auth/provider-enrollment-actions.ts", {
    "next/cache": { revalidatePath: (...args) => calls.push(["revalidate", ...args]) },
    "next/navigation": { redirect },
    "./profile": { getCurrentProfile: async () => member },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async (...args) => { calls.push(["rpc", ...args]); return { error }; } }) },
  }).startProviderApplication;
  return { action, calls };
}

test("provider enrollment submits only the authenticated RPC, with no caller-supplied account id or role", async () => {
  const { action, calls } = enrollment({ ...profile, role: "customer", primaryRole: "customer" });
  await assert.rejects(action({ id: otherId, role: "admin" }, new FormData()), (error) => error instanceof Redirect && error.path === "/dashboard/provider/onboarding");
  assert.deepEqual(calls, [["rpc", "start_provider_application"], ["revalidate", "/", "layout"]]);
  const failed = enrollment({ ...profile, role: "customer" }, { message: "database detail must stay private" });
  assert.deepEqual(await failed.action({}), { message: "We couldn’t start your application. Please try again or contact support." });
  assert.deepEqual(failed.calls, [["rpc", "start_provider_application"]]);
});

test("existing provider applications and their approval decisions cannot be reset by starting again", async () => {
  for (const providerStatus of ["pending", "approved", "rejected", "suspended"]) {
    const member = { ...profile, providerStatus };
    const { action, calls } = enrollment(member);
    await assert.rejects(action({}), (error) => error instanceof Redirect && error.path === "/dashboard/provider/onboarding");
    assert.deepEqual(calls, [["revalidate", "/", "layout"]]);
    assert.equal(member.providerStatus, providerStatus);
  }
  const admin = enrollment({ ...profile, role: "admin", primaryRole: "admin" });
  assert.match((await admin.action({})).message, /customer account/);
  assert.deepEqual(admin.calls, []);
});

test("Offer Services is a read-only entry point until a customer explicitly starts the application", async () => {
  for (const [member, expected] of [[null, "/signup?role=provider"], [profile, "/dashboard/provider/onboarding"], [{ ...profile, role: "admin", primaryRole: "admin" }, "/dashboard/admin"]]) {
    const Page = loadOfferPage(member);
    await assert.rejects(Page(), (error) => error instanceof Redirect && error.path === expected);
  }
  const customer = { ...profile, role: "customer", primaryRole: "customer" };
  const tree = await loadOfferPage(customer)();
  assert.equal(elements(tree, (node) => node.type === "ProviderApplicationStart").length, 1);
  assert.equal(customer.role, "customer");
  const Alias = load("../src/app/dashboard/provider/application/page.tsx", { "next/navigation": { redirect } }).default;
  assert.throws(() => Alias(), (error) => error instanceof Redirect && error.path === "/offer-services");
});

function loadOfferPage(member) {
  return load("../src/app/offer-services/page.tsx", {
    "next/navigation": { redirect },
    "@/lib/auth/profile": { getOptionalCurrentProfile: async () => member, getRoleDashboardPath: (role) => `/dashboard/${role}` },
    "@/lib/auth/access": { hasProviderAccess },
    "@/components/site-header": { SiteHeader: "SiteHeader" },
    "@/components/provider/provider-application-start": { ProviderApplicationStart: "ProviderApplicationStart" },
    "@/components/site-design.module.css": { default: styles },
  }).default;
}

function bookingRow(overrides = {}) {
  return { id: bookingId, customer_id: memberId, provider_id: otherId, customer_name: "Member", provider_name: "Their Provider", service_name: "Service", pricing_type: "fixed", price_cents: 12500, agreed_price_cents: 12500, price_set_at: null, requested_date: "2026-12-01", requested_start_time: "10:00:00", service_location: "Customer address", customer_notes: "", status: "accepted", provider_response: "", responded_at: null, completed_at: null, created_at: "2026-11-23T00:00:00Z", ...overrides };
}

function loadMarketplace(member, db) {
  return load("../src/lib/marketplace/data.ts", {
    "./booking-messaging": { bookingConversationWritable },
    "server-only": {},
    "next/navigation": { redirect },
    zod: { z },
    "@/lib/auth/profile": { getCurrentProfile: async () => member, requireRole: async () => member },
    "@/lib/auth/access": { hasCustomerAccess },
    "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/cases/data": { bookingCaseColumns: "id", mapBookingCase: (row) => row, resolutionMigrationMissing: () => false },
  });
}

test("dual-account inbox combines only the member's two booking roles and labels the actual counterpart", async () => {
  const asCustomer = bookingRow();
  const asProvider = bookingRow({ id: "44444444-4444-4444-8444-444444444444", customer_id: otherId, provider_id: memberId, customer_name: "Their Customer", provider_name: "Member" });
  const db = database({ rows: { booking_requests: [asCustomer, asProvider], booking_messages: [{ id: "message", booking_id: asProvider.id, sender_id: otherId, body: "Hello", created_at: "2026-11-23T01:00:00Z" }] } });
  const inbox = await loadMarketplace(profile, db).getConversationInbox();
  assert.deepEqual(db.calls.filter((call) => call[1] === "or"), [["booking_requests", "or", `customer_id.eq.${memberId},provider_id.eq.${memberId}`]]);
  assert.deepEqual(db.calls.find((call) => call[0] === "booking_messages" && call[1] === "in"), ["booking_messages", "in", "booking_id", [asCustomer.id, asProvider.id]]);
  assert.deepEqual(inbox.conversations.map((conversation) => conversation.counterpartName), ["Their Customer", "Their Provider"]);
  assert.equal(inbox.conversations[0].lastMessage.body, "Hello");
  for (const [role, customerAccess, column] of [["customer", true, "customer_id"], ["provider", false, "provider_id"]]) {
    const singleDb = database({ rows: { booking_requests: [] } });
    await loadMarketplace({ ...profile, role, customerAccess }, singleDb).getConversationInbox();
    assert.deepEqual(singleDb.calls.find((call) => call[1] === "eq"), ["booking_requests", "eq", column, memberId]);
    assert.ok(!singleDb.calls.some((call) => call[1] === "or" || call[0] === "booking_messages"));
  }
});

test("conversation context follows participation while retaining the account's provider identity", async () => {
  for (const perspective of ["customer", "provider"]) {
    const row = bookingRow(perspective === "provider" ? { customer_id: otherId, provider_id: memberId, customer_name: "Their Customer", provider_name: "Member" } : {});
    const db = database({ rows: { booking_requests: row } });
    const conversation = await loadMarketplace(profile, db).getBookingConversation(bookingId);
    assert.equal(conversation.perspective, perspective);
    assert.equal(conversation.profile.role, perspective);
    assert.equal(conversation.profile.primaryRole, "provider");
    assert.equal(conversation.counterpartName, perspective === "customer" ? "Their Provider" : "Their Customer");
    assert.equal(conversation.canSend, true);
    const Page = load("../src/app/dashboard/messages/[bookingId]/page.tsx", {
      "next/link": { default: "Link" },
      "next/navigation": { notFound: () => assert.fail("Known participant should see the conversation") },
      zod: { z },
      "@/components/dashboard/dashboard-shell": { DashboardShell: "DashboardShell" },
      "@/components/dashboard/customer-icon": { CustomerIcon: "CustomerIcon" },
      "@/components/messages/conversation-live-updates": { ConversationLiveUpdates: "LiveUpdates" },
      "@/components/messages/message-composer": { MessageComposer: "Composer" },
      "@/lib/marketplace/data": { getBookingConversation: async () => conversation },
      "@/lib/providers/presentation": { labelFromSnakeCase: (value) => value },
      "@/components/messages/messages.module.css": { default: styles },
    }).default;
    const tree = await Page({ params: Promise.resolve({ bookingId }) });
    assert.equal(tree.props.profile.role, perspective);
    assert.ok(elements(tree, (node) => node.type === "Link").some((node) => node.props.href === `/dashboard/${perspective}/bookings/${bookingId}`));
  }
  const unrelated = database({ rows: { booking_requests: bookingRow({ customer_id: otherId, provider_id: "unrelated" }) } });
  assert.equal(await loadMarketplace(profile, unrelated).getBookingConversation(bookingId), null);
  assert.deepEqual([...new Set(unrelated.calls.map((call) => call[0]))], ["booking_requests"]);
});

test("marketplace actions derive the account id from claims and require the requested capability", async () => {
  for (const [role, customerAccess, capability, allowed] of [["provider", true, "customer", true], ["provider", true, "provider", true], ["provider", false, "customer", false], ["customer", false, "provider", false], ["customer", false, "customer", true]]) {
    const db = database({ rows: { profiles: profileRow(role, customerAccess) } });
    const action = loadMarketplace(profile, db).requireMarketplaceActionRole;
    if (allowed) assert.equal((await action(capability)).userId, memberId);
    else await assert.rejects(action(capability), new RegExp(`Only ${capability} accounts`));
    assert.deepEqual(db.calls.find((call) => call[1] === "eq"), ["profiles", "eq", "id", memberId]);
  }
  const db = database({ claims: null });
  await assert.rejects(loadMarketplace(profile, db).requireMarketplaceActionRole("customer"), /must be signed in/);
  assert.deepEqual(db.calls, []);
});
