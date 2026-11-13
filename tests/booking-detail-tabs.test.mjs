import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import ts from "typescript";

const css = new Proxy({}, { get: (_target, key) => String(key) });
function load(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { BookingDetailTabs } = load("../src/components/marketplace/booking-detail-tabs.tsx", {
  react: React,
  "react/jsx-runtime": jsxRuntime,
  "./booking-detail.module.css": { default: css },
});

const panels = {
  overview: React.createElement("section", { "data-testid": "completion-photos" }, "Completed work and private photos"),
  payment: React.createElement("section", null, "Payment due"),
  help: React.createElement("section", null, "Booking support"),
  review: React.createElement("section", null, "Review your service"),
};

function selectedTab(html) {
  const selected = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .filter((match) => /aria-selected="true"/.test(match[1]));
  assert.equal(selected.length, 1, "Exactly one tab should be selected");
  return selected[0][2].replace(/<[^>]+>/g, "");
}

function panelTag(html, key) {
  const match = html.match(new RegExp(`<div\\b[^>]*id="[^"]*-${key}-panel"[^>]*>`));
  assert.ok(match, `Missing ${key} panel`);
  return match[0];
}

test("a payment-due booking defaults to its Payment tab", () => {
  const html = renderToStaticMarkup(React.createElement(BookingDetailTabs, { ...panels, paymentDue: true }));
  assert.equal(selectedTab(html), "Payment");
  assert.doesNotMatch(panelTag(html, "payment"), /\shidden(?:=|\s|>)/);
  assert.match(panelTag(html, "overview"), /\shidden(?:=|\s|>)/);
  assert.match(html, /aria-label="Payment due"/);
});

test("the email's explicit Overview destination reveals completed-work photos even when payment is due", () => {
  const html = renderToStaticMarkup(React.createElement(BookingDetailTabs, { ...panels, paymentDue: true, initialTab: "overview" }));
  assert.equal(selectedTab(html), "Overview");
  assert.doesNotMatch(panelTag(html, "overview"), /\shidden(?:=|\s|>)/);
  assert.match(panelTag(html, "payment"), /\shidden(?:=|\s|>)/);
  assert.match(html, /data-testid="completion-photos"/);
  assert.match(html, /aria-label="Payment due"/, "Payment remains available and marked due");
});

test("a booking without payment due keeps Overview as its default", () => {
  const html = renderToStaticMarkup(React.createElement(BookingDetailTabs, panels));
  assert.equal(selectedTab(html), "Overview");
  assert.doesNotMatch(panelTag(html, "overview"), /\shidden(?:=|\s|>)/);
  assert.doesNotMatch(html, /aria-label="Payment due"/);
});

test("the actual customer booking page passes only its approved Overview query into the rendered tabs", async () => {
  const bookingId = "22222222-2222-4222-8222-222222222222";
  const propsSeen = [];
  const page = load("../src/app/dashboard/customer/bookings/[bookingId]/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "@/components/navigation-actions.module.css": { default: css },
    "next/link": { default: ({ href, children }) => React.createElement("a", { href }, children) },
    "next/navigation": { notFound: () => { throw new Error("Unexpected missing booking"); } },
    zod: { z },
    "@/components/dashboard/dashboard-shell": { DashboardShell: ({ children }) => React.createElement("main", null, children) },
    "@/components/dashboard/customer-icon": { CustomerIcon: () => null },
    "@/components/dashboard/customer-dashboard.module.css": { default: css },
    "@/lib/marketplace/booking-messaging": { bookingConversationWritable: () => true },
    "@/lib/marketplace/data": { getCustomerBookings: async () => ({ customer: { id: "customer" }, bookings: [{ id: bookingId, status: "completed", serviceName: "Completed service" }] }) },
    "@/lib/marketplace/completion-photos": { getBookingCompletionPhotos: async () => ({ photos: [{ id: "photo" }], error: null }) },
    "@/components/marketplace/booking-card": { BookingCard: (props) => {
      propsSeen.push(props);
      return React.createElement(BookingDetailTabs, { ...panels, paymentDue: true, initialTab: props.initialTab });
    } },
  }).default;
  for (const [tab, expected] of [["overview", "Overview"], [undefined, "Payment"], ["help", "Payment"]]) {
    const tree = await page({ params: Promise.resolve({ bookingId }), searchParams: Promise.resolve({ tab }) });
    const html = renderToStaticMarkup(tree);
    assert.equal(selectedTab(html), expected);
    assert.equal(propsSeen.at(-1).initialTab, tab === "overview" ? "overview" : undefined);
    assert.equal(propsSeen.at(-1).completionPhotos.length, 1);
  }
});
