import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customerBookingGroups,
  customerCalendarDay,
  customerPaymentDue,
  customerPaymentLabel,
} from "../src/lib/marketplace/customer-dashboard.ts";

// Run with: node --experimental-strip-types --test tests/customer-dashboard.test.mjs
function booking(id, status = "accepted", paymentStatus = "paid", date = "2026-11-06") {
  return {
    id, status, agreedPriceCents: 500, requestedDate: date,
    requestedStartTime: "10:00",
    payment: paymentStatus === null ? null : { status: paymentStatus },
  };
}

test("only unpaid accepted prices request payment; processing and refunds never do", () => {
  for (const status of [null, "failed", "expired", "checkout_pending"]) {
    assert.equal(customerPaymentDue(booking("due", "accepted", status)), true);
  }
  for (const status of ["paid", "processing", "partially_refunded", "refunded"]) {
    assert.equal(customerPaymentDue(booking("final", "accepted", status)), false);
  }
  assert.equal(customerPaymentDue(booking("pending", "pending", null)), false);
  assert.equal(customerPaymentDue(booking("completed", "completed", null)), false);
  assert.equal(customerPaymentDue({ ...booking("no-price", "accepted", null), agreedPriceCents: null }), false);
});

test("payment labels always reflect recorded payment state", () => {
  assert.equal(customerPaymentLabel(booking("paid")), "Paid");
  assert.equal(customerPaymentLabel(booking("processing", "accepted", "processing")), "Payment processing");
  assert.equal(customerPaymentLabel(booking("partial", "accepted", "partially_refunded")), "Partially refunded");
  assert.equal(customerPaymentLabel(booking("refund", "cancelled", "refunded")), "Refunded");
  assert.equal(customerPaymentLabel(booking("due", "accepted", null)), "Payment due");
});

test("past open bookings stay open and accessible instead of becoming history", () => {
  const past = booking("past-open", "accepted", "paid", "2026-10-09");
  const complete = booking("completed", "completed", "paid", "2026-10-10");
  const pending = booking("request", "pending", null);
  const groups = customerBookingGroups([past, complete, pending], "2026-11-02");
  assert.deepEqual(groups.pastOpen.map(item => item.id), ["past-open"]);
  assert.deepEqual(groups.history.map(item => item.id), ["completed"]);
  assert.equal(groups.all.length, 3);
  assert.equal(groups.all[0].status, "accepted");
});

test("next visits are paid, future accepted bookings in appointment order", () => {
  const input = [
    booking("later", "accepted", "paid", "2026-11-12"),
    booking("due", "accepted", null, "2026-11-03"),
    booking("processing", "accepted", "processing", "2026-11-04"),
    booking("next", "accepted", "paid", "2026-11-06"),
    booking("cancelled", "cancelled", "paid", "2026-11-05"),
    booking("past", "accepted", "paid", "2026-10-30"),
  ];
  const groups = customerBookingGroups(input, "2026-11-02");
  assert.deepEqual(groups.upcoming.map(item => item.id), ["next", "later"]);
  assert.deepEqual(groups.requests.map(item => item.id), ["due", "processing"]);
  assert.equal(input[0].id, "later");
});

test("the calendar comparison does not advance early at UTC midnight", () => {
  assert.equal(customerCalendarDay(new Date("2026-11-03T02:00:00Z")), "2026-11-02");
  assert.equal(customerCalendarDay(new Date("2026-07-03T02:00:00Z")), "2026-07-02");
});
