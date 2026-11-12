import assert from "node:assert/strict";
import { test } from "node:test";
import { providerBookingGroups, providerNeedsPrice, providerPaymentLabel, providerCaseNeedsResponse } from "../src/lib/marketplace/provider-dashboard.ts";

function booking(id, status = "accepted", paymentStatus = null, date = "2026-11-10") {
  return { id, status, agreedPriceCents: 8000, requestedDate: date, requestedStartTime: "10:00", payment: paymentStatus === null ? null : { status: paymentStatus }, supportCase: null };
}

test("upcoming accepted visits include unpaid work and existing prepaid bookings", () => {
  const source = [booking("later", "accepted", "paid", "2026-11-12"), booking("processing", "accepted", "processing"), booking("partial", "accepted", "partially_refunded"), booking("unpaid"), booking("past", "accepted", null, "2026-10-09"), booking("cancelled", "cancelled", "paid")];
  assert.deepEqual(providerBookingGroups(source, "2026-11-04").upcoming.map((item) => item.id), ["processing", "partial", "unpaid", "later"]);
  assert.equal(source[0].id, "later");
});

test("past dates preserve open bookings regardless of payment state", () => {
  const source = [booking("paid-open", "accepted", "paid", "2026-10-09"), booking("unpaid-open", "accepted", null, "2026-10-10"), booking("finished", "completed", "paid", "2026-10-11")];
  const groups = providerBookingGroups(source, "2026-11-04");
  assert.deepEqual(groups.pastOpen.map((item) => item.id), ["paid-open", "unpaid-open"]);
  assert.deepEqual(groups.history.map((item) => item.id), ["finished"]);
  assert.equal(groups.all.length, 3);
  assert.equal(source[0].status, "accepted");
});

test("completed unpaid and processing visits remain in Awaiting payment, not History", () => {
  const source = [null, "failed", "expired", "checkout_pending", "processing", "paid", "partially_refunded", "refunded"]
    .map((status, index) => booking(String(index), "completed", status));
  const groups = providerBookingGroups(source, "2026-11-04");
  assert.deepEqual(groups.awaitingPayment.map((item) => item.id), ["0", "1", "2", "3", "4"]);
  assert.deepEqual(groups.history.map((item) => item.id), ["5", "6", "7"]);
  assert.equal(groups.all.length, source.length);
});

test("only new requests appear in Requests", () => {
  const groups = providerBookingGroups([booking("new", "pending"), booking("accepted"), booking("finished", "completed"), booking("cancelled", "cancelled")], "2026-11-04");
  assert.deepEqual(groups.requests.map((item) => item.id), ["new"]);
  assert.deepEqual(groups.history.map((item) => item.id), ["cancelled"]);
});

test("missing price prompts remain editable through unpaid completion but respect checkout locks", () => {
  for (const bookingStatus of ["accepted", "completed"]) {
    for (const status of [null, "failed", "expired"]) assert.equal(providerNeedsPrice({ ...booking("missing", bookingStatus, status), agreedPriceCents: null }), true);
    for (const status of ["checkout_pending", "processing", "paid", "partially_refunded", "refunded"]) assert.equal(providerNeedsPrice({ ...booking("locked", bookingStatus, status), agreedPriceCents: null }), false);
  }
  assert.equal(providerNeedsPrice(booking("has-price")), false);
  assert.equal(providerNeedsPrice({ ...booking("pending", "pending"), agreedPriceCents: null }), false);
});

test("payment labels distinguish scheduled work, finished unpaid work, and collected money", () => {
  assert.equal(providerPaymentLabel(booking("scheduled")), "Pay after service");
  assert.equal(providerPaymentLabel(booking("finished", "completed")), "Awaiting customer payment");
  assert.equal(providerPaymentLabel({ ...booking("missing"), agreedPriceCents: null }), "Price needed");
  assert.equal(providerPaymentLabel(booking("processing", "completed", "processing")), "Payment processing");
  assert.equal(providerPaymentLabel(booking("refunded", "cancelled", "refunded")), "Refunded");
});

test("only an unanswered open resolution request needs a new response", () => {
  assert.equal(providerCaseNeedsResponse(booking("none")), false);
  assert.equal(providerCaseNeedsResponse({ ...booking("open"), supportCase: { status: "open", providerResponse: null } }), true);
  for (const status of ["provider_responded", "under_review", "resolved_refunded", "closed"]) assert.equal(providerCaseNeedsResponse({ ...booking("case"), supportCase: { status, providerResponse: null } }), false);
  assert.equal(providerCaseNeedsResponse({ ...booking("responded"), supportCase: { status: "open", providerResponse: "I have responded." } }), false);
});
