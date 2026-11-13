"use client";

import { useActionState } from "react";
import { cancelBooking } from "@/lib/marketplace/actions";
import { initialMarketplaceActionState } from "@/lib/marketplace/types";
import { ActionFeedback } from "./action-feedback";
import styles from "./booking-forms.module.css";

export function BookingCancelForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    cancelBooking,
    initialMarketplaceActionState,
  );

  return (
    <form action={action} className={`${styles.form} ${styles.inline}`}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <ActionFeedback state={state} tone="info" />
      <button
        type="submit"
        disabled={pending}
        className={`${styles.secondary} ${styles.danger}`}
      >
        {pending ? "Cancelling…" : "Cancel request"}
      </button>
    </form>
  );
}
