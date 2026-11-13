"use client";

import { useActionState } from "react";
import { startBookingCheckout } from "@/lib/payments/actions";
import {
  initialPaymentActionState,
  type PaymentStatus,
} from "@/lib/payments/types";
import { PaymentFeedback } from "./payment-feedback";
import styles from "@/components/marketplace/booking-forms.module.css";

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
    <form action={action} className={`${styles.form} ${styles.inline}`}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <PaymentFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className={styles.primary}
      >
        {pending
          ? "Opening secure checkout…"
          : paymentStatus === "checkout_pending"
            ? "Continue secure checkout"
            : "Pay securely with Stripe"}
      </button>
      <p className={styles.hint}>
        Payment details are entered on Stripe and are never stored by Auxilium.
      </p>
    </form>
  );
}
