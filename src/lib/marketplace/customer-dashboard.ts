import type { BookingRequest } from "./types";
import type { PaymentStatus } from "@/lib/payments/types";

export const customerPaymentLabels: Record<PaymentStatus, string> = {
  checkout_pending: "Checkout started",
  processing: "Payment processing",
  paid: "Paid",
  failed: "Payment failed",
  expired: "Checkout expired",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

export function customerBookingPath(bookingId: string) {
  return `/dashboard/customer/bookings/${encodeURIComponent(bookingId)}`;
}

export function formatCustomerMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatCustomerBookingDate(booking: BookingRequest) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(`${booking.requestedDate}T${booking.requestedStartTime}:00`));
}

// These are local calendar dates. This comparison only affects presentation;
// it never changes a booking's status or a payment's state.
export function customerCalendarDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function customerPaymentDue(booking: BookingRequest) {
  return booking.status === "accepted" && booking.agreedPriceCents !== null &&
    (!booking.payment || ["failed", "expired", "checkout_pending"].includes(booking.payment.status));
}

export function customerPaymentLabel(booking: BookingRequest) {
  if (booking.payment) return customerPaymentLabels[booking.payment.status];
  if (customerPaymentDue(booking)) return "Payment due";
  return booking.status === "accepted" ? "Awaiting final price" : "Not paid";
}

export function customerBookingGroups(bookings: BookingRequest[], today = customerCalendarDay()) {
  const paymentSettled = (booking: BookingRequest) =>
    booking.payment?.status === "paid" || booking.payment?.status === "partially_refunded";
  const byAppointment = (a: BookingRequest, b: BookingRequest) =>
    `${a.requestedDate}T${a.requestedStartTime}`.localeCompare(`${b.requestedDate}T${b.requestedStartTime}`);
  return {
    all: bookings,
    upcoming: bookings.filter((booking) => booking.status === "accepted" && paymentSettled(booking) && booking.requestedDate >= today).sort(byAppointment),
    requests: bookings.filter((booking) => booking.status === "pending" || (booking.status === "accepted" && !paymentSettled(booking))),
    history: bookings.filter((booking) => ["completed", "declined", "cancelled"].includes(booking.status)),
    pastOpen: bookings.filter((booking) => booking.status === "accepted" && paymentSettled(booking) && booking.requestedDate < today),
  };
}
