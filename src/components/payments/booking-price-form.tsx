"use client";

import { NumberField } from "@/components/ui/fields";
import { useActionState } from "react";
import { setBookingPrice } from "@/lib/payments/actions";
import { initialPaymentActionState } from "@/lib/payments/types";
import { PaymentFeedback } from "./payment-feedback";
import styles from "@/components/marketplace/booking-forms.module.css";

export function BookingPriceForm({
  bookingId,
  defaultAmountCents,
  hasAgreedPrice = false,
}: {
  bookingId: string;
  defaultAmountCents: number | null;
  hasAgreedPrice?: boolean;
}) {
  const [state, action, pending] = useActionState(
    setBookingPrice,
    initialPaymentActionState,
  );

  return (
    <form action={action} className={`${styles.form} ${styles.section}`}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className={styles.field}>
        Agreed booking price (USD)
        <span className={styles.hint}>
          Save the full total agreed with your customer. You can update it again
          before checkout starts. Auxilium’s 5% commission is calculated automatically.
        </span>
          <NumberField
            name="amount"
            min="1"
            max="1000000"
            step="0.01"
            required
            defaultValue={
              defaultAmountCents === null
                ? undefined
                : (defaultAmountCents / 100).toFixed(2)
            }
            aria-label="Agreed booking price in US dollars"
            placeholder="0.00"
            className={styles.control}
          />
      </label>
      {state.fieldErrors?.amount?.[0] && (
        <p className={styles.fieldError}>{state.fieldErrors.amount[0]}</p>
      )}
      <PaymentFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className={styles.primary}
      >
        {pending ? "Saving…" : hasAgreedPrice ? "Update price" : "Save price"}
      </button>
    </form>
  );
}
