export type BookingRefundStatus = "pending" | "requires_action" | "succeeded" | "failed" | "canceled";

/** Stripe API v1 may prune idempotency keys after 24 hours. Use a shorter
 * retry window for intents whose Stripe ID was never recorded. Known refunds
 * are always retrieved by ID, never created again.
 * https://docs.stripe.com/api/idempotent_requests
 */
export function canRetryBookingRefund(
  refund: { stripeRefundId: string | null; createdAt: string },
  now = Date.now(),
) {
  if (refund.stripeRefundId) return true;
  const age = now - Date.parse(refund.createdAt);
  return Number.isFinite(age) && age >= -5 * 60_000 && age < 23 * 60 * 60_000;
}

export function bookingRefundNotification(refund: {
  id: string;
  amountCents: number;
  status: string;
}) {
  if (!Number.isInteger(refund.amountCents) || refund.amountCents < 100) return null;
  const amount = `$${(refund.amountCents / 100).toFixed(2)}`;
  const content = {
    pending: {
      subject: "Your Auxillium booking refund is pending",
      heading: "The booking refund is pending",
      message: `${amount} is awaiting Stripe confirmation. The refund is not complete yet. Open your dashboard for its current status.`,
    },
    requires_action: {
      subject: "Your Auxillium booking refund needs attention",
      heading: "The booking refund needs attention",
      message: `${amount} is awaiting an additional step in Stripe. The refund has not completed. Open your dashboard for the current status and resolution notes.`,
    },
    succeeded: {
      subject: "Your Auxillium booking refund is confirmed",
      heading: "The booking refund is confirmed",
      message: `Stripe confirmed the ${amount} refund. Your booking’s payment balance has been updated. Open your dashboard for the payment details and resolution notes.`,
    },
    failed: {
      subject: "Your Auxillium booking refund could not be completed",
      heading: "The booking refund could not be completed",
      message: `Stripe could not complete the ${amount} refund. This refund has not been recorded as completed. Open your dashboard for the current status and resolution notes.`,
    },
    canceled: {
      subject: "Your Auxillium booking refund was canceled",
      heading: "The booking refund was canceled",
      message: `The ${amount} refund was canceled and has not been recorded as completed. Open your dashboard for the current status and resolution notes.`,
    },
  };
  if (!Object.hasOwn(content, refund.status)) return null;
  return {
    ...content[refund.status as BookingRefundStatus],
    eventKey: `booking_refund_${refund.id}_${refund.status}`,
  };
}
