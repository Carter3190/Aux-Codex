import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const bookingId = "33333333-3333-4333-8333-333333333333";
const customerId = "11111111-1111-4111-8111-111111111111";
const providerId = "22222222-2222-4222-8222-222222222222";
const adminId = "44444444-4444-4444-8444-444444444444";
const booking = { id: bookingId, customer_id: customerId, provider_id: providerId, customer_name: "Customer", provider_name: "Provider", service_name: "Test service" };
const input = { bookingId, eventKey: "booking_notification", subject: "Booking update", heading: "Update", message: "Your booking was updated." };

function notifier({ customerRole = "provider", bookingError = null, participantError = null } = {}) {
  const sends = [], queries = [], logs = [];
  const profiles = [
    { id: providerId, email: "provider@example.test", full_name: "Provider", role: "provider" },
    { id: customerId, email: "customer@example.test", full_name: "Customer", role: customerRole },
  ];
  const admins = [{ id: adminId, email: "admin@example.test", full_name: "Admin", role: "admin" }];
  const db = { from(table) {
    const filters = [];
    const query = {
      select(columns) { queries.push({ table, columns, filters }); return query; },
      eq(column, value) { filters.push(["eq", column, value]); return query; },
      in(column, value) { filters.push(["in", column, value]); return query; },
      single() { return Promise.resolve(result()); },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
    function result() {
      if (table === "booking_requests") return { data: booking, error: bookingError };
      if (table === "booking_cases") return { data: { booking_id: bookingId }, error: null };
      assert.equal(table, "profiles");
      if (filters.some(([method, column, value]) => method === "eq" && column === "role" && value === "admin")) {
        return { data: admins, error: null };
      }
      return { data: profiles, error: participantError };
    }
    return query;
  } };
  const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/email/notifications.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loaded = { exports: {} };
  const dependencies = {
    "server-only": {},
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "./send": {
      sendTransactionalEmail: async (value) => { sends.push(value); return { status: "sent" }; },
      sendBookingCompletionEmail: () => assert.fail("Generic booking notifications must not send completion email"),
    },
  };
  new Function("require", "module", "exports", "console", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, loaded, loaded.exports, { error: (...values) => logs.push(values) });
  return { ...loaded.exports, sends, queries, logs };
}

test("booking email recipients and dashboard links follow booking participation before and after provider enrollment", async () => {
  const roles = ["customer", "provider", "admin"];
  for (const customerRole of ["customer", "provider"]) {
    for (let mask = 0; mask < 8; mask += 1) {
      const recipients = roles.filter((_role, index) => mask & (1 << index));
      const sender = notifier({ customerRole });
      await sender.notifyBookingParticipants({ ...input, recipients });
      const expected = [
        ...recipients.includes("provider") ? [["provider@example.test", "/dashboard/provider", providerId]] : [],
        ...recipients.includes("customer") ? [["customer@example.test", "/dashboard/customer", customerId]] : [],
        ...recipients.includes("admin") ? [["admin@example.test", "/dashboard/admin/cases", adminId]] : [],
      ];
      assert.deepEqual(sender.sends.map(({ to, actionPath, idempotencyKey }) => [to, actionPath, idempotencyKey]), expected.map(([to, path, id]) => [to, path, `${input.eventKey}_${id}`]), `customer role=${customerRole}; recipients=${recipients}`);
      assert.ok(sender.sends.every((email) => email.message === `${input.message} Service: Test service.`));
      assert.ok(sender.sends.every((email) => email.actionLabel === (email.to === "admin@example.test" ? "Review in Auxillium" : "Open your dashboard")));
      assert.equal(sender.logs.length, 0);
      assert.ok(sender.queries.some(({ table, filters }) => table === "profiles" && filters.some(([method, column, ids]) => method === "in" && column === "id" && ids.join() === [customerId, providerId].join())));
    }
  }
});

test("provider-only updates do not email the booking customer after the customer starts offering services", async () => {
  const sender = notifier();
  await sender.notifyBookingParticipants({ ...input, recipients: ["provider"] });
  assert.deepEqual(sender.sends.map(({ to }) => to), ["provider@example.test"]);
});

test("case responses reach the converted customer and keep the customer dashboard destination", async () => {
  const sender = notifier();
  await sender.notifyCaseParticipants({ ...input, caseId: "case", recipients: ["customer", "admin"] });
  assert.deepEqual(sender.sends.map(({ to, actionPath }) => [to, actionPath]), [
    ["customer@example.test", "/dashboard/customer"],
    ["admin@example.test", "/dashboard/admin/cases"],
  ]);
  assert.ok(sender.queries.some(({ table, filters }) => table === "booking_cases" && filters.some(([method, column, id]) => method === "eq" && column === "id" && id === "case")));
});

test("unavailable booking or participant records cannot send guessed booking notifications", async () => {
  for (const error of [{ bookingError: { message: "private booking error" } }, { participantError: { message: "private profile error" } }]) {
    const sender = notifier(error);
    await sender.notifyBookingParticipants({ ...input, recipients: ["customer", "provider", "admin"] });
    assert.deepEqual(sender.sends, []);
    assert.doesNotMatch(JSON.stringify(sender.logs), /private|example\.test/);
  }
});
