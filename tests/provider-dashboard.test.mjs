import assert from "node:assert/strict";
import { test } from "node:test";
import { providerBookingGroups, providerNeedsPrice, providerPaymentLabel, providerCaseNeedsResponse } from "../src/lib/marketplace/provider-dashboard.ts";

function booking(id, status = "accepted", paymentStatus = "paid", date = "2026-11-10") {
  return { id, status, agreedPriceCents: 8000, requestedDate: date, requestedStartTime: "10:00", payment: paymentStatus === null ? null : { status: paymentStatus }, supportCase: null };
}
test("upcoming visits require accepted paid or partially refunded bookings in appointment order", () => {
  const source = [booking("later", "accepted", "paid", "2026-11-12"), booking("processing", "accepted", "processing"), booking("partial", "accepted", "partially_refunded"), booking("unpaid", "accepted", null), booking("past", "accepted", "paid", "2026-10-09"), booking("cancelled", "cancelled", "paid")];
  assert.deepEqual(providerBookingGroups(source, "2026-11-04").upcoming.map((item) => item.id), ["partial", "later"]);
  assert.equal(source[0].id, "later");
});
test("past dates preserve open bookings regardless of payment state", () => {
  const source = [booking("paid-open", "accepted", "paid", "2026-10-09"), booking("unpaid-open", "accepted", null, "2026-10-10"), booking("finished", "completed", "paid", "2026-10-11")];
  const groups = providerBookingGroups(source, "2026-11-04");
  assert.deepEqual(groups.pastOpen.map((item) => item.id), ["paid-open", "unpaid-open"]);
  assert.deepEqual(groups.history.map((item) => item.id), ["finished"]);
  assert.equal(groups.all.length, 3);assert.equal(source[0].status, "accepted");
});
test("only new requests appear in the requests filter", () => {
  const groups = providerBookingGroups([booking("new", "pending", null), booking("accepted-unpaid", "accepted", null), booking("cancelled", "cancelled", null)], "2026-11-04");
  assert.deepEqual(groups.requests.map((item) => item.id), ["new"]);
  assert.deepEqual(groups.history.map((item) => item.id), ["cancelled"]);
});
test("missing price prompts respect checkout and completed-payment locks", () => {
  for (const status of [null, "failed", "expired"]) assert.equal(providerNeedsPrice({ ...booking("missing", "accepted", status), agreedPriceCents: null }), true);
  for (const status of ["checkout_pending", "processing", "paid", "partially_refunded", "refunded"]) assert.equal(providerNeedsPrice({ ...booking("locked", "accepted", status), agreedPriceCents: null }), false);
  assert.equal(providerNeedsPrice(booking("has-price", "accepted", null)), false);
  assert.equal(providerNeedsPrice({ ...booking("pending", "pending", null), agreedPriceCents: null }), false);
});
test("payment labels distinguish accepted prices from collected money", () => {
  assert.equal(providerPaymentLabel(booking("unpaid", "accepted", null)), "Awaiting customer payment");
  assert.equal(providerPaymentLabel({ ...booking("missing", "accepted", null), agreedPriceCents: null }), "Price needed");
  assert.equal(providerPaymentLabel(booking("processing", "accepted", "processing")), "Payment processing");
  assert.equal(providerPaymentLabel(booking("refunded", "cancelled", "refunded")), "Refunded");
});
test("only an unanswered open resolution request needs a new response", () => {
  assert.equal(providerCaseNeedsResponse(booking("none")), false);
  assert.equal(providerCaseNeedsResponse({ ...booking("open"), supportCase: { status: "open", providerResponse: null } }), true);
  for (const status of ["provider_responded", "under_review", "resolved_refunded", "closed"]) assert.equal(providerCaseNeedsResponse({ ...booking("case"), supportCase: { status, providerResponse: null } }), false);
  assert.equal(providerCaseNeedsResponse({ ...booking("responded"), supportCase: { status: "open", providerResponse: "I have responded." } }), false);
});
