"use client";

import { useActionState, useState } from "react";
import { respondToBooking } from "@/lib/marketplace/actions";
import { initialMarketplaceActionState } from "@/lib/marketplace/types";
import { ActionFeedback } from "./action-feedback";
import styles from "./booking-forms.module.css";

export function BookingResponseForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    respondToBooking,
    initialMarketplaceActionState,
  );
  const [decision, setDecision] = useState("accepted");

  return (
    <form action={action} className={`${styles.form} ${styles.section}`}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <h3 className={styles.heading}>Your response</h3>
      <label className={styles.field}>
        Response note <span className={styles.optional}>(optional)</span>
        <textarea
          name="notes"
          rows={4}
          maxLength={1000}
          className={styles.control}
          placeholder="Confirm next steps or explain why this time does not work."
        />
      </label>
      {state.fieldErrors?.notes?.[0] && (
        <p className={styles.fieldError}>{state.fieldErrors.notes[0]}</p>
      )}
      <ActionFeedback state={state} tone={decision === "declined" ? "declined" : "success"} />
      <div className={styles.actions}>
        <button
          type="submit"
          name="decision"
          value="accepted"
          disabled={pending}
          onClick={() => setDecision("accepted")}
          className={styles.primary}
        >
          Accept request
        </button>
        <button
          type="submit"
          name="decision"
          value="declined"
          disabled={pending}
          onClick={() => setDecision("declined")}
          className={`${styles.secondary} ${styles.danger}`}
        >
          Decline request
        </button>
      </div>
    </form>
  );
}
