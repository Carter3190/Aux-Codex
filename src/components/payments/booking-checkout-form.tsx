"use client";

import { useActionState } from "react";
import { startBookingCheckout } from "@/lib/payments/actions";
import {
  initialPaymentActionState,
  type PaymentStatus,
} from "@/lib/payments/types";
import { PaymentFeedback } from "./payment-feedback";

export function BookingCheckoutForm({
  bookingId,
  paymentStatus,
}: {
  bookingId: string;
  paymentStatus: PaymentStatus | null;
}) {
  const [state, action, pending] = useActionState(
    startBookingCheckout,
    initialPaymentActionState,
  );

  return (
    <form action={action} className="mt-5 space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <PaymentFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending
          ? "Opening secure checkout…"
          : paymentStatus === "checkout_pending"
            ? "Continue secure checkout"
            : "Pay securely with Stripe"}
      </button>
      <p className="text-xs leading-5 text-muted">
        Payment details are entered on Stripe and are never stored by Auxilium.
      </p>
    </form>
  );
}
