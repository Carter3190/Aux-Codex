import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { createBookingCompletionEmail, renderBookingCompletionEmail } from "../src/lib/email/booking-completion.ts";

const bookingId = "22222222-2222-4222-8222-222222222222";
const customerId = "11111111-1111-4111-8111-111111111111";
const base = {
  bookingId, customerId, recipientName: "Alex Morgan", providerName: "Harbor Home Services",
  serviceName: "home maintenance visit", requestedDate: "2026-11-19", requestedStartTime: "10:00:00",
  agreedPriceCents: 12500, paymentStatus: null,
};

function loadModule(path, dependencies, extraNames = [], extraValues = []) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", ...extraNames, compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, loaded, loaded.exports, ...extraValues);
  return loaded.exports;
}

test("unpaid completion email links to its authenticated booking and never includes private photos", () => {
  const content = createBookingCompletionEmail(base);
  const rendered = renderBookingCompletionEmail(content, `https://app.example.test${content.actionPath}`);
  assert.equal(content.actionPath, `/dashboard/customer/bookings/${bookingId}?tab=overview`);
  assert.equal(content.actionLabel, "View completed booking");
  assert.equal(content.idempotencyKey, `booking_completed_${bookingId}_${customerId}`);
  assert.ok(content.details.some(({ label, value }) => label === "Payment due" && value === "$125.00"));
  assert.match(rendered.text, /November 19, 2026 · 10:00 AM/);
  assert.match(rendered.text, /does not charge you automatically/);
  assert.match(rendered.text, /photos.*after you sign in/);
  assert.doesNotMatch(rendered.html, /<img|storage\/v1|signedUrl|attachment|https?:\/\/(?!app\.example\.test)/);
  assert.match(rendered.html, /background:#345f94/);
});

test("paid and refunded legacy bookings are never asked to pay again", () => {
  for (const paymentStatus of ["paid", "partially_refunded", "refunded", "processing", "checkout_pending"]) {
    const content = createBookingCompletionEmail({ ...base, paymentStatus, paymentAmountCents: 12500, refundedAmountCents: 2500 });
    const rendered = renderBookingCompletionEmail(content, `https://app.example.test${content.actionPath}`);
    assert.ok(!content.details.some(({ label }) => label === "Payment due"));
    assert.doesNotMatch(rendered.text, /pay securely from your booking|No payment has been collected/);
    if (paymentStatus === "paid") assert.match(rendered.text, /payment has already been received/);
    if (paymentStatus === "processing") assert.match(rendered.text, /payment attempt is in progress/);
  }
});

test("completion email escapes user content and keeps hostile booking values inside the app path", () => {
  const content = createBookingCompletionEmail({ ...base, bookingId: "//outside.test/<tag>", recipientName: '<img src=x onerror="bad()">', providerName: "<script>bad()</script>", serviceName: "A&B service" });
  assert.match(content.actionPath, /^\/dashboard\/customer\/bookings\/%2F%2Foutside/);
  const rendered = renderBookingCompletionEmail(content, `https://app.example.test${content.actionPath}`);
  assert.match(rendered.html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(rendered.html, /A&amp;B service/);
  assert.doesNotMatch(rendered.html, /<script>|<img src=x/);
  const unknown = createBookingCompletionEmail({ ...base, agreedPriceCents: null, paymentStatus: "unknown" });
  assert.ok(!unknown.details.some(({ label }) => label === "Payment due"));
});

function sender({ configured = true, response = async () => ({ ok: true, status: 200 }) } = {}) {
  const requests = [], logs = [];
  const senderModule = loadModule("../src/lib/email/send.ts", {
    "server-only": {},
    "@/lib/stripe/config": { getAppUrl: () => "https://app.example.test" },
    "./config": { isTransactionalEmailConfigured: () => configured, getTransactionalEmailConfig: () => ({ apiKey: "re_TEST_ONLY", from: "Auxilium <test@example.test>" }) },
    "./booking-completion": { createBookingCompletionEmail, renderBookingCompletionEmail },
  }, ["fetch", "console"], [async (url, options) => { requests.push({ url, options }); return response(); }, { error: (...args) => logs.push(args) }]);
  return { send: senderModule.sendBookingCompletionEmail, requests, logs };
}

test("completion delivery uses a stable Resend key, one recipient, and no photo attachments", async () => {
  const { send, requests } = sender();
  const input = { ...base, to: "alex@example.test" };
  assert.deepEqual(await send(input), { status: "sent" });
  assert.deepEqual(await send(input), { status: "sent" });
  const first = requests[0];
  assert.equal(first.url, "https://api.resend.com/emails");
  assert.equal(first.options.headers["Idempotency-Key"], requests[1].options.headers["Idempotency-Key"]);
  const payload = JSON.parse(first.options.body);
  assert.deepEqual(payload.to, ["alex@example.test"]);
  assert.ok(!Object.hasOwn(payload, "attachments"));
  assert.match(payload.html, new RegExp(`/dashboard/customer/bookings/${bookingId}\\?tab=overview`));
  assert.equal(first.options.cache, "no-store");
});

test("missing configuration and delivery failures do not throw or disclose private content", async () => {
  const off = sender({ configured: false });
  assert.deepEqual(await off.send({ ...base, to: "alex@example.test" }), { status: "skipped" });
  assert.equal(off.requests.length, 0);
  for (const response of [async () => ({ ok: false, status: 429 }), async () => { throw new Error("private account and API details"); }]) {
    const { send, logs } = sender({ response });
    assert.deepEqual(await send({ ...base, to: "alex@example.test" }), { status: "failed" });
    assert.doesNotMatch(JSON.stringify(logs), /alex@example|Harbor|private account|re_TEST_ONLY/);
  }
});

function notifier({ status = "completed", payment = null, paymentError = null } = {}) {
  const calls = [], sends = [], logs = [];
  const booking = { id: bookingId, customer_id: customerId, customer_name: "Alex", provider_name: base.providerName, service_name: base.serviceName, requested_date: base.requestedDate, requested_start_time: base.requestedStartTime, agreed_price_cents: base.agreedPriceCents, status };
  const customer = { id: customerId, email: "alex@example.test", full_name: base.recipientName, role: "provider" };
  const admin = { from: (table) => ({ select: (columns) => ({ eq: (column, value) => {
    calls.push({ table, columns, column, value });
    return {
      single: async () => ({ data: table === "booking_requests" ? booking : customer, error: null }),
      maybeSingle: async () => ({ data: payment, error: paymentError }),
    };
  } }) }) };
  const notifierModule = loadModule("../src/lib/email/notifications.ts", {
    "server-only": {}, "@/lib/supabase/admin": { createAdminClient: () => admin },
    "./send": { sendBookingCompletionEmail: async (input) => { sends.push(input); return { status: "sent" }; }, sendTransactionalEmail: () => { throw new Error("Generic dashboard email should not be used"); } },
  }, ["console"], [{ error: (...args) => logs.push(args) }]);
  return { notify: notifierModule.notifyBookingCompletion, calls, sends, logs };
}

test("completion notification targets the booking customer by ID, regardless of current profile role", async () => {
  const { notify, calls, sends } = notifier();
  assert.deepEqual(await notify({ bookingId }), { status: "sent" });
  assert.equal(sends.length, 1);
  assert.equal(sends[0].customerId, customerId);
  assert.equal(sends[0].to, "alex@example.test");
  assert.ok(calls.some((call) => call.table === "profiles" && call.column === "id" && call.value === customerId));
  assert.ok(!calls.some((call) => call.column === "role"));
});

test("completion notification cannot announce unfinished work or guess an unavailable payment state", async () => {
  const unfinished = notifier({ status: "accepted" });
  assert.deepEqual(await unfinished.notify({ bookingId }), { status: "skipped" });
  assert.equal(unfinished.sends.length, 0);
  const unavailable = notifier({ paymentError: { message: "private payment details" } });
  assert.deepEqual(await unavailable.notify({ bookingId }), { status: "failed" });
  assert.equal(unavailable.sends.length, 0);
  assert.doesNotMatch(JSON.stringify(unavailable.logs), /private payment details|alex@example/);
});
