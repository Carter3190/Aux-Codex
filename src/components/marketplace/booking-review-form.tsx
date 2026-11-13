"use client";

import { SelectField } from "@/components/ui/fields";
import { useActionState } from "react";
import { submitBookingReview } from "@/lib/marketplace/actions";
import { initialMarketplaceActionState } from "@/lib/marketplace/types";
import { ActionFeedback } from "./action-feedback";
import styles from "./booking-forms.module.css";

export function BookingReviewForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    submitBookingReview,
    initialMarketplaceActionState,
  );

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <div>
        <h3 className={styles.heading}>Review your completed service</h3>
        <p className={styles.description}>
          Your review will be labeled as coming from a verified Auxilium booking.
        </p>
      </div>
      <label className={styles.field}>
        Rating
        <SelectField
          name="rating"
          defaultValue="5"
          className={styles.control}
        >
          <option value="5">★★★★★ — Excellent</option>
          <option value="4">★★★★☆ — Great</option>
          <option value="3">★★★☆☆ — Good</option>
          <option value="2">★★☆☆☆ — Poor</option>
          <option value="1">★☆☆☆☆ — Very poor</option>
        </SelectField>
      </label>
      {state.fieldErrors?.rating?.[0] && (
        <p className={styles.fieldError}>{state.fieldErrors.rating[0]}</p>
      )}
      <label className={styles.field}>
        Your experience
        <textarea
          name="body"
          rows={4}
          minLength={10}
          maxLength={2000}
          required
          className={styles.control}
          placeholder="What went well, and what should future customers know?"
        />
      </label>
      {state.fieldErrors?.body?.[0] && (
        <p className={styles.fieldError}>{state.fieldErrors.body[0]}</p>
      )}
      <ActionFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className={styles.primary}
      >
        {pending ? "Publishing review…" : "Publish verified review"}
      </button>
    </form>
  );
}
