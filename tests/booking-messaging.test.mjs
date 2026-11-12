import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingConversationWritable } from "../src/lib/marketplace/booking-messaging.ts";

const now = new Date("2026-11-11T16:00:00Z");
const oldCompleted = { status: "completed", completedAt: "2026-09-01T16:00:00Z", payment: null };

test("payment collection conversations remain writable for completed unpaid work after 30 days", () => {
  for (const status of [null, "failed", "expired", "checkout_pending", "processing"]) {
    assert.equal(bookingConversationWritable({ ...oldCompleted, payment: status ? { status } : null }, now), true);
  }
});

test("paid, partially refunded, and refunded conversations retain the 30 day follow-up limit", () => {
  for (const status of ["paid", "partially_refunded", "refunded"]) {
    assert.equal(bookingConversationWritable({ ...oldCompleted, payment: { status } }, now), false);
    assert.equal(bookingConversationWritable({ ...oldCompleted, completedAt: "2026-11-10T16:00:00Z", payment: { status } }, now), true);
    assert.equal(bookingConversationWritable({ ...oldCompleted, completedAt: null, payment: { status } }, now), false);
  }
});

test("a scheduled visit remains writable while declined and cancelled visits do not", () => {
  for (const status of ["pending", "accepted"]) assert.equal(bookingConversationWritable({ ...oldCompleted, status }, now), true);
  for (const status of ["declined", "cancelled"]) assert.equal(bookingConversationWritable({ ...oldCompleted, status }, now), false);
});
