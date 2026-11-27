import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { z } from "zod";
import * as customerDashboard from "../src/lib/marketplace/customer-dashboard.ts";
import * as providerDashboard from "../src/lib/marketplace/provider-dashboard.ts";
import * as messaging from "../src/lib/marketplace/booking-messaging.ts";
import * as capabilities from "../src/lib/marketplace/booking-action-capabilities.ts";

const css = new Proxy({}, { get: (_, key) => String(key) });
const Link = ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children);
function load(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name.endsWith(".module.css")) return { default: css };
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const marker = (name) => function TestMarker() { return React.createElement("div", { "data-component": name }); };
const { BookingResponseForm } = load("../src/components/marketplace/booking-response-form.tsx", {
  react: React,
  "@/lib/marketplace/actions": { respondToBooking: async () => assert.fail("Rendering must not respond") },
  "@/lib/marketplace/types": { initialMarketplaceActionState: {} },
  "./action-feedback": { ActionFeedback: () => null },
});
const { BookingCard } = load("../src/components/marketplace/booking-card.tsx", {
  "next/link": { default: Link },
  "./booking-cancel-form": { BookingCancelForm: marker("cancel") },
  "./booking-completion-form": { BookingCompletionForm: marker("complete") },
  "./booking-review-form": { BookingReviewForm: marker("review") },
  "./booking-response-form": { BookingResponseForm },
  "./booking-completion-gallery": { BookingCompletionGallery: marker("photos") },
  "./action-feedback": { ActionFeedback: () => null },
  "./booking-detail-tabs": { BookingDetailTabs: ({ overview, payment, help, review }) => React.createElement("div", null, overview, payment, help, review) },
  "@/components/payments/booking-checkout-form": { BookingCheckoutForm: marker("checkout") },
  "@/components/payments/booking-price-form": { BookingPriceForm: marker("price") },
  "@/components/payments/provider-earnings-summary": { ProviderEarningsSummary: marker("earnings") },
  "@/components/cases/booking-case-request-form": { BookingCaseRequestForm: marker("case") },
  "@/components/cases/booking-resolution-panel": { BookingResolutionPanel: marker("resolution") },
  "@/components/dashboard/customer-icon": { CustomerIcon: () => null },
  "@/lib/marketplace/customer-dashboard": customerDashboard,
  "@/lib/marketplace/provider-dashboard": providerDashboard,
  "@/lib/providers/presentation": { formatPrice: () => "$125.00", labelFromSnakeCase: (value) => value },
  "@/lib/marketplace/booking-messaging": messaging,
  "@/lib/marketplace/booking-action-capabilities": capabilities,
});
const base = { id: "10000000-0000-4000-8000-000000000001", customerId: "customer", providerId: "provider", customerName: "Customer", providerName: "Provider", serviceName: "Service", status: "accepted", pricingType: "fixed", priceCents: 12500, agreedPriceCents: 12500, requestedDate: "2026-01-01", requestedStartTime: "10:00", serviceLocation: "A location", payment: null, review: null, supportCase: null, providerActions: { canAccept: false, acceptUnavailableReason: "request_closed", canSetPrice: true, priceUnavailableReason: null } };
const card = (changes = {}, perspective = "provider") => renderToStaticMarkup(React.createElement(BookingCard, { booking: { ...base, ...changes }, perspective }));
function buttonTag(html, label) {
  const found = [...html.matchAll(/<button\b([^>]*)>([^<]+)<\/button>/g)].find((match) => match[2] === label);
  assert.ok(found, `Missing ${label}`);
  return found[1];
}

test("unavailable acceptance explains the restriction while preserving decline", () => {
  for (const reason of ["approval_required", "service_review_required", "slot_unavailable", "unavailable"]) {
    const html = card({ status: "pending", providerActions: { ...base.providerActions, acceptUnavailableReason: reason } });
    assert.match(buttonTag(html, "Accept request"), /disabled/);
    assert.doesNotMatch(buttonTag(html, "Decline request"), /disabled/);
    assert.ok(html.includes(capabilities.providerBookingActionMessage(reason)));
  }
  const available = card({ status: "pending", providerActions: { ...base.providerActions, canAccept: true, acceptUnavailableReason: null } });
  assert.doesNotMatch(buttonTag(available, "Accept request"), /disabled/);
});

test("price actions fail closed but historical work can still be completed", () => {
  for (const providerActions of [undefined, { ...base.providerActions, canSetPrice: false, priceUnavailableReason: "approval_required" }]) {
    const html = card({ providerActions });
    assert.doesNotMatch(html, /data-component="price"/);
    assert.match(html, /data-component="complete"/, "Provider approval does not revoke legitimate completion of accepted work");
    assert.match(html, /Message customer/);
  }
  assert.match(card(), /data-component="price"/);
  assert.doesNotMatch(card({ payment: { status: "checkout_pending" } }), /data-component="price"/);
});

test("closed bookings explain that no price, payment or future review action is due", () => {
  for (const status of ["cancelled", "declined"]) {
    for (const perspective of ["customer", "provider"]) {
      const html = card({ status, agreedPriceCents: null, providerActions: undefined }, perspective);
      assert.match(html, /This booking is closed\. No payment is due\./);
      assert.match(html, /Reviews unavailable/);
      assert.doesNotMatch(html, /Waiting for the provider|Save the full price|You can leave a verified review after|Your customer can leave a verified review after/);
      assert.doesNotMatch(html, /data-component="(?:price|checkout|review|complete)"/);
    }
  }
  const historical = card({ status: "cancelled", payment: { status: "refunded", amountCents: 12500, refundedAmountCents: 12500 } }, "customer");
  assert.match(historical, /payment or refund already recorded remains available/);
  assert.match(historical, /Refunded: \$125\.00 of \$125\.00/);
  const reviewed = card({ status: "cancelled", review: { rating: 4, body: "A historical verified review.", createdAt: "2026-01-01" } }, "customer");
  assert.match(reviewed, /A historical verified review/);
});

test("closed empty conversations do not invite messages and explain the actual closure", async () => {
  for (const status of ["cancelled", "declined", "completed"]) {
    const booking = { ...base, status, completedAt: "2026-01-01T00:00:00Z", payment: { status: "paid" } };
    const Page = load("../src/app/dashboard/messages/[bookingId]/page.tsx", {
      "next/link": { default: Link }, "next/navigation": { notFound: () => assert.fail("Owned conversation exists") }, zod: { z },
      "@/components/dashboard/dashboard-shell": { DashboardShell: ({ children }) => React.createElement("main", null, children) },
      "@/components/dashboard/customer-icon": { CustomerIcon: () => null },
      "@/components/messages/conversation-live-updates": { ConversationLiveUpdates: () => null },
      "@/components/messages/message-composer": { MessageComposer: marker("composer") },
      "@/lib/marketplace/data": { getBookingConversation: async () => ({ profile: { id: "customer" }, booking, messages: [], counterpartName: "Provider", canSend: false, perspective: "customer" }) },
      "@/lib/marketplace/booking-messaging": messaging,
      "@/lib/providers/presentation": { labelFromSnakeCase: (value) => value },
    }).default;
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ bookingId: base.id }) }));
    assert.match(html, /No messages in this conversation/);
    assert.doesNotMatch(html, /Start the conversation|Ask a question or coordinate|data-component="composer"/);
    assert.match(html, new RegExp(status === "completed" ? "30-day follow-up window" : status === "declined" ? "request was declined" : "booking was cancelled"));
  }
  assert.equal(messaging.bookingConversationReadOnlyMessage({ ...base, status: "completed", completedAt: "2026-01-01", payment: null }), null, "Finished unpaid work remains writable");
});
