import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { z } from "zod";
import { unavailableProviderBookingActions } from "../src/lib/marketplace/booking-action-capabilities.ts";
import { bookingConversationWritable } from "../src/lib/marketplace/booking-messaging.ts";

const id = (number) => `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const row = (number) => ({ id: id(number), customer_id: id(9000), provider_id: id(9001), customer_name: "Customer", provider_name: "Provider", service_name: "Visit", pricing_type: "fixed", price_cents: 12500, agreed_price_cents: null, requested_date: "2026-12-01", requested_start_time: "10:00:00", status: "pending", customer_notes: "", provider_response: "", created_at: "2026-11-27T00:00:00Z" });
function dataLayer(rows, rpc) {
  const calls = [];
  const db = {
    from(table) {
      const query = {};
      for (const method of ["select", "eq", "in", "order"]) query[method] = (...args) => { calls.push([table, method, ...args]); return query; };
      query.then = (resolve, reject) => Promise.resolve({ data: table === "booking_requests" ? rows : [], error: null }).then(resolve, reject);
      return query;
    },
    async rpc(name, args) { calls.push([name, args]); return rpc(name, args); },
  };
  const dependencies = {
    "./booking-messaging": { bookingConversationWritable },
    "./booking-action-capabilities": { unavailableProviderBookingActions },
    "server-only": {}, "next/navigation": { redirect: () => assert.fail("A display lookup must not redirect away from history") }, zod: { z },
    "@/lib/auth/profile": { requireRole: async (role) => { assert.equal(role, "provider"); return { id: id(9001), role }; } },
    "@/lib/auth/access": {}, "@/lib/supabase/server": { createClient: async () => db },
    "@/lib/cases/data": { bookingCaseColumns: "id", mapBookingCase: (item) => item, resolutionMigrationMissing: () => false },
  };
  const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/marketplace/data.ts", import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, compiledModule, compiledModule.exports);
  return { calls, getProviderBookings: compiledModule.exports.getProviderBookings };
}
const allowed = (bookingId) => ({ booking_id: bookingId, can_accept: true, accept_unavailable_reason: null, can_set_price: false, price_unavailable_reason: "price_unavailable" });

test("booking capability reads are bounded, scoped to returned own bookings and mapped to each record", async () => {
  const rows = Array.from({ length: 501 }, (_, index) => row(index + 1));
  const layer = dataLayer(rows, (name, args) => {
    assert.equal(name, "get_provider_booking_action_capabilities");
    assert.ok(args.requested_booking_ids.length <= 500);
    assert.deepEqual(Object.keys(args), ["requested_booking_ids"]);
    return { data: args.requested_booking_ids.map(allowed), error: null };
  });
  const bookings = await layer.getProviderBookings();
  assert.equal(bookings.length, 501);
  assert.ok(bookings.every((booking) => booking.providerActions.canAccept && !booking.providerActions.canSetPrice));
  assert.deepEqual(layer.calls.filter(([name]) => name === "get_provider_booking_action_capabilities").map(([, args]) => args.requested_booking_ids.length), [500, 1]);
  assert.ok(layer.calls.some(([table, method, column, value]) => table === "booking_requests" && method === "eq" && column === "provider_id" && value === id(9001)));
});

test("unavailable or invalid display capabilities disable guarded actions without losing history", async () => {
  for (const result of [
    { data: null, error: { code: "PGRST202" } },
    { data: [{ ...allowed(id(1)), can_accept: "true" }], error: null },
    { data: [allowed(id(2))], error: null },
    { data: [], error: null },
  ]) {
    const bookings = await dataLayer([row(1)], () => result).getProviderBookings();
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0].serviceName, "Visit");
    assert.deepEqual(bookings[0].providerActions, unavailableProviderBookingActions);
  }
  const bookings = await dataLayer([row(1)], () => { throw new Error("Temporary transport error"); }).getProviderBookings();
  assert.deepEqual(bookings[0].providerActions, unavailableProviderBookingActions);
  const empty = dataLayer([], () => assert.fail("No booking ids should make no capability request"));
  assert.deepEqual(await empty.getProviderBookings(), []);
});
