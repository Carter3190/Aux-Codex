import type { BookingRequest } from "./types";

// Mirror the server's message permission while keeping payment collection
// conversations available for finished work that is still unpaid.
export function bookingConversationWritable(
  booking: Pick<BookingRequest, "status" | "completedAt" | "payment">,
  now = new Date(),
) {
  if (booking.status === "pending" || booking.status === "accepted") return true;
  if (booking.status !== "completed") return false;
  const settled = Boolean(booking.payment && ["paid", "partially_refunded", "refunded"].includes(booking.payment.status));
  if (!settled) return true;
  return Boolean(booking.completedAt && new Date(booking.completedAt).getTime() > now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

export function bookingConversationReadOnlyMessage(
  booking: Pick<BookingRequest, "status" | "completedAt" | "payment">,
  now = new Date(),
) {
  if (bookingConversationWritable(booking, now)) return null;
  if (booking.status === "cancelled") return "This conversation is read-only because the booking was cancelled.";
  if (booking.status === "declined") return "This conversation is read-only because the request was declined.";
  return "This conversation is read-only because the 30-day follow-up window for this completed visit has ended.";
}
