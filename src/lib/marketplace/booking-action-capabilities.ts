import type { ProviderBookingActions } from "./types";

export const unavailableProviderBookingActions: ProviderBookingActions = {
  canAccept: false,
  acceptUnavailableReason: "unavailable",
  canSetPrice: false,
  priceUnavailableReason: "unavailable",
};

export function providerBookingActionMessage(
  reason: ProviderBookingActions["acceptUnavailableReason"] | ProviderBookingActions["priceUnavailableReason"],
) {
  switch (reason) {
    case "approval_required":
      return "Auxillium must approve your provider profile before you can accept requests or change booking prices.";
    case "service_review_required":
      return "This service needs current credential approval for the visit date before you can accept this request.";
    case "slot_unavailable":
      return "You already accepted another booking at this time. You can still decline this request.";
    case "request_closed":
      return "This request has already received a response.";
    case "price_unavailable":
      return "A price can be set only for an accepted or completed visit.";
    case "checkout_started":
      return "The price cannot change after checkout has started.";
    default:
      return "Booking actions are temporarily unavailable. Refresh this page or contact support.";
  }
}
