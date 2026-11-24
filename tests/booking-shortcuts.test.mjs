import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as customerDashboard from "../src/lib/marketplace/customer-dashboard.ts";
import * as providerDashboard from "../src/lib/marketplace/provider-dashboard.ts";
import * as stripeStatus from "../src/lib/payments/stripe-setup-status.ts";

const css = new Proxy({}, { get: (_target, key) => String(key) });
const Link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
const shared = {
  "react/jsx-runtime": jsxRuntime, "next/link": { default: Link },
  "@/components/dashboard/dashboard-shell": { DashboardShell: ({ children }) => React.createElement("main", null, children) },
  "./dashboard-shell": { DashboardShell: ({ children }) => React.createElement("main", null, children) },
  "@/components/dashboard/customer-icon": { CustomerIcon: () => null }, "./customer-icon": { CustomerIcon: () => null },
  "@/components/dashboard/customer-bookings": { CustomerPaymentBadge: () => null, CustomerCheckoutFeedback: () => null, CustomerEmptyState: () => null },
  "./customer-bookings": { CustomerPaymentBadge: () => null, CustomerCheckoutFeedback: () => null, CustomerEmptyState: () => null },
  "./provider-bookings": { ProviderPaymentBadge: () => null },
  "@/components/payments/provider-stripe-setup-card": { ProviderStripeSetupCard: () => null },
  "@/lib/marketplace/customer-dashboard": customerDashboard,
  "@/lib/marketplace/provider-dashboard": providerDashboard,
  "@/lib/payments/stripe-setup-status": stripeStatus,
  "./customer-dashboard.module.css": { default: css }, "./provider-dashboard.module.css": { default: css },
  "@/components/dashboard/customer-dashboard.module.css": { default: css },
};
function load(path, extra = {}) {
  const dependencies = { ...shared, ...extra };
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
function hrefFor(html, text) {
  const link = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .find((match) => match[2].replace(/<[^>]*>/g, "").trim() === text);
  assert.ok(link, `Missing ${text} shortcut`);
  return link[1];
}
const profile = { id: "account", fullName: "Alex Morgan", role: "customer", providerStatus: "not_applicable" };
const booking = { id: "booking", status: "completed", agreedPriceCents: 12500, requestedDate: "2026-11-12", requestedStartTime: "10:00", serviceName: "Visit", customerName: "Alex Morgan", providerName: "Local Provider", review: null, supportCase: null, payment: { status: "paid", amountCents: 12500, refundedAmountCents: 0, paidAt: "2026-11-12T12:00:00Z" } };

test("the customer dashboard's review shortcut goes directly to Review", () => {
  const { CustomerOverview } = load("../src/components/dashboard/customer-overview.tsx");
  const html = renderToStaticMarkup(React.createElement(CustomerOverview, { profile, bookings: [booking] }));
  assert.equal(hrefFor(html, "Leave a review"), "/dashboard/customer/bookings/booking?tab=review");
});

test("paid payment-history rows open Payment even when no payment is due", async () => {
  const { default: CustomerPaymentsPage } = load("../src/app/dashboard/customer/payments/page.tsx", {
    "@/lib/marketplace/data": { getCustomerBookings: async () => ({ customer: profile, bookings: [booking] }) },
  });
  const html = renderToStaticMarkup(await CustomerPaymentsPage());
  assert.equal(hrefFor(html, "View payment"), "/dashboard/customer/bookings/booking?tab=payment");
});

test("provider action shortcuts open their specific Payment and Help panels", () => {
  const { ProviderOverview } = load("../src/components/dashboard/provider-overview.tsx");
  const provider = { ...profile, role: "provider", providerStatus: "approved" };
  const needsPrice = { ...booking, id: "price", status: "accepted", agreedPriceCents: null, payment: null };
  const support = { ...booking, id: "concern", supportCase: { status: "open", providerResponse: null } };
  const html = renderToStaticMarkup(React.createElement(ProviderOverview, {
    workspace: { profile: provider, details: { businessName: "Local Provider", submittedAt: "2026-11-01" }, completion: { completedCount: 5, totalCount: 5 }, reviewEvents: [] },
    bookings: [needsPrice, support], serviceReviewNeeded: false,
    paymentSetup: { configured: true, migrationInstalled: true, hasAccount: true, ready: true, status: "ready" },
  }));
  assert.equal(hrefFor(html, "Set price"), "/dashboard/provider/bookings/price?tab=payment");
  assert.equal(hrefFor(html, "Review request"), "/dashboard/provider/bookings/concern?tab=help");
});
