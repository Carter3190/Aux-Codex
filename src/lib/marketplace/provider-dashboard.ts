import type { BookingRequest } from "./types";

export function providerBookingPath(bookingId: string) {
  return `/dashboard/provider/bookings/${encodeURIComponent(bookingId)}`;
}

export function providerNeedsPrice(booking: BookingRequest) {
  return booking.status === "accepted" && booking.agreedPriceCents === null &&
    (!booking.payment || ["failed", "expired"].includes(booking.payment.status));
}

export function providerCaseNeedsResponse(booking: BookingRequest) {
  return booking.supportCase?.status === "open" && !booking.supportCase.providerResponse;
}

export function providerPaymentLabel(booking: BookingRequest) {
  const status = booking.payment?.status;
  if (status) {
    const labels = {
      checkout_pending: "Checkout started", processing: "Payment processing", paid: "Paid",
      failed: "Payment failed", expired: "Checkout expired", partially_refunded: "Partially refunded", refunded: "Refunded",
    };
    return labels[status];
  }
  if (booking.status === "accepted") return booking.agreedPriceCents === null ? "Price needed" : "Awaiting customer payment";
  return "Not paid";
}

// Presentation only: a past appointment date never completes a booking.
export function providerBookingGroups(bookings: BookingRequest[], today: string) {
  const settled = (booking: BookingRequest) => booking.payment?.status === "paid" || booking.payment?.status === "partially_refunded";
  const byAppointment = (a: BookingRequest, b: BookingRequest) => `${a.requestedDate}T${a.requestedStartTime}`.localeCompare(`${b.requestedDate}T${b.requestedStartTime}`);
  return {
    all: bookings,
    requests: bookings.filter((booking) => booking.status === "pending"),
    upcoming: bookings.filter((booking) => booking.status === "accepted" && settled(booking) && booking.requestedDate >= today).sort(byAppointment),
    history: bookings.filter((booking) => ["completed", "declined", "cancelled"].includes(booking.status)),
    pastOpen: bookings.filter((booking) => booking.status === "accepted" && booking.requestedDate < today),
    priceNeeded: bookings.filter(providerNeedsPrice),
    caseResponses: bookings.filter(providerCaseNeedsResponse),
  };
}
