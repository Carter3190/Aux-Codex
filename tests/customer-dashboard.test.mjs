import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customerBookingGroups, customerCalendarDay, customerPaymentDue, customerPaymentLabel,
} from "../src/lib/marketplace/customer-dashboard.ts";

function booking(id, status = "accepted", paymentStatus = null, date = "2026-11-06") {
  return { id, status, agreedPriceCents: 500, requestedDate: date, requestedStartTime: "10:00",
    payment: paymentStatus === null ? null : { status: paymentStatus } };
}

test("payment becomes due only after completion and a confirmed price", () => {
  for (const status of [null, "failed", "expired", "checkout_pending"]) {
    assert.equal(customerPaymentDue(booking("finished", "completed", status)), true);
    assert.equal(customerPaymentDue(booking("scheduled", "accepted", status)), false);
  }
  for (const status of ["paid", "processing", "partially_refunded", "refunded"]) {
    assert.equal(customerPaymentDue(booking("locked", "completed", status)), false);
  }
  for (const status of ["pending", "declined", "cancelled"]) {
    assert.equal(customerPaymentDue(booking("not-finished", status)), false);
  }
  assert.equal(customerPaymentDue({ ...booking("no-price", "completed"), agreedPriceCents: null }), false);
});

test("payment labels separate scheduled work, payment due, and confirmed payment state", () => {
  assert.equal(customerPaymentLabel(booking("scheduled")), "Pay after service");
  assert.equal(customerPaymentLabel({ ...booking("no-price"), agreedPriceCents: null }), "Awaiting final price");
  assert.equal(customerPaymentLabel(booking("due", "completed")), "Payment due");
  assert.equal(customerPaymentLabel(booking("paid", "completed", "paid")), "Paid");
  assert.equal(customerPaymentLabel(booking("processing", "completed", "processing")), "Payment processing");
  assert.equal(customerPaymentLabel(booking("partial", "completed", "partially_refunded")), "Partially refunded");
  assert.equal(customerPaymentLabel(booking("refund", "cancelled", "refunded")), "Refunded");
});

test("upcoming accepted visits stay visible before payment or price confirmation", () => {
  const input = [
    booking("later", "accepted", "paid", "2026-11-12"),
    booking("unpaid", "accepted", null, "2026-11-03"),
    { ...booking("unpriced", "accepted", null, "2026-11-04"), agreedPriceCents: null },
    booking("processing-legacy", "accepted", "processing", "2026-11-05"),
    booking("request", "pending", null, "2026-11-06"),
    booking("cancelled", "cancelled", "paid", "2026-11-05"),
    booking("past", "accepted", null, "2026-10-30"),
  ];
  const groups = customerBookingGroups(input, "2026-11-02");
  assert.deepEqual(groups.upcoming.map(item => item.id), ["unpaid", "unpriced", "processing-legacy", "later"]);
  assert.deepEqual(groups.requests.map(item => item.id), ["request"]);
  assert.deepEqual(groups.pastOpen.map(item => item.id), ["past"]);
  assert.equal(input[0].id, "later");
});

test("completed unpaid and processing work remains visible until payment is settled", () => {
  const input = [null, "failed", "expired", "checkout_pending", "processing", "paid", "partially_refunded", "refunded"]
    .map((status, index) => booking(String(index), "completed", status));
  const groups = customerBookingGroups(input);
  assert.deepEqual(groups.awaitingPayment.map(item => item.id), ["0", "1", "2", "3", "4"]);
  assert.deepEqual(groups.history.map(item => item.id), ["5", "6", "7"]);
  assert.equal(groups.all.length, input.length);
  assert.equal(groups.requests.length, 0);
});

test("a visit date alone never finishes work or makes payment due", () => {
  const past = booking("past-open", "accepted", null, "2026-10-09");
  const groups = customerBookingGroups([past], "2026-11-02");
  assert.deepEqual(groups.pastOpen.map(item => item.id), ["past-open"]);
  assert.equal(groups.history.length, 0);
  assert.equal(groups.awaitingPayment.length, 0);
  assert.equal(customerPaymentDue(past), false);
  assert.equal(past.status, "accepted");
});

test("calendar comparisons do not advance early at UTC midnight", () => {
  assert.equal(customerCalendarDay(new Date("2026-11-03T02:00:00Z")), "2026-11-02");
  assert.equal(customerCalendarDay(new Date("2026-07-03T02:00:00Z")), "2026-07-02");
});
