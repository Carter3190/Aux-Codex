"use client";

import { NumberField, SelectField } from "@/components/ui/fields";
import { useActionState, useId } from "react";
import { openBookingCase } from "@/lib/cases/actions";
import { initialCaseActionState } from "@/lib/cases/types";
import { CaseFeedback } from "./case-feedback";
import styles from "./booking-case-request-form.module.css";

function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export function BookingCaseRequestForm({
  bookingId,
  remainingRefundCents,
  allowCancellation = false,
  bookingContext,
}: {
  bookingId: string;
  remainingRefundCents: number;
  allowCancellation?: boolean;
  bookingContext?: {
    serviceName: string;
    providerName: string;
    paidAmountCents: number;
    paymentLabel?: "Paid" | "Partially refunded";
  };
}) {
  const [state, action, pending] = useActionState(
    openBookingCase,
    initialCaseActionState,
  );
  const id = useId();

  return (
    <section className={styles.card} aria-labelledby={`${id}-heading`}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Booking support</p>
        <h3 id={`${id}-heading`}>Request help with a booking</h3>
        <p>Open a private resolution request for Auxilium to review.</p>
      </header>
      {bookingContext && (
        <div className={styles.context}>
          <div>
            <h4>{bookingContext.serviceName}</h4>
            <p>{bookingContext.providerName}</p>
          </div>
          <span className={styles.badge}>
            {bookingContext.paymentLabel ?? "Paid"} · {new Intl.NumberFormat("en-US", {
              style: "currency", currency: "USD",
            }).format(bookingContext.paidAmountCents / 100)}
          </span>
        </div>
      )}
    <form
      action={action}
      className={styles.form}
      aria-label="Customer resolution request"
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className={styles.fields}>
        <label className={styles.field}>
          Request type
          <SelectField
            name="category"
            defaultValue="service_issue"
            className={styles.control}
          >
            {allowCancellation && <option value="cancellation">Cancellation request</option>}
            <option value="service_issue">Service issue</option>
            <option value="duplicate_charge">Possible duplicate charge</option>
            <option value="other">Other payment issue</option>
          </SelectField>
        </label>
        <label className={styles.field}>
          Requested refund (USD)
          <NumberField
            name="amount"
            min="1"
            max={dollars(remainingRefundCents)}
            step="0.01"
            defaultValue={dollars(remainingRefundCents)}
            required
            className={styles.control}
            aria-describedby={`${id}-refund-limit`}
          />
          <span id={`${id}-refund-limit`} className={styles.hint}>
            Up to ${dollars(remainingRefundCents)} remains refundable.
          </span>
        </label>
      </div>
      {state.fieldErrors?.amount?.[0] && (
        <p className={styles.error}>{state.fieldErrors.amount[0]}</p>
      )}
      <label className={styles.field}>
        What happened?
        <textarea
          name="details"
          rows={4}
          minLength={20}
          maxLength={4000}
          required
          className={`${styles.control} ${styles.details}`}
          placeholder="Describe what happened, what outcome you requested from the provider, and any dates or details that will help us review it."
        />
      </label>
      {state.fieldErrors?.details?.[0] && (
        <p className={styles.error}>{state.fieldErrors.details[0]}</p>
      )}
      <div className={styles.reviewNote}>
        Auxilium reviews your details and the provider’s response before any
        refund is sent. Submitting a request does not automatically issue a refund.
      </div>
      <CaseFeedback state={state} />
      <div className={styles.actions}><button
        type="submit"
        disabled={pending}
        className={styles.primary}
      >
        {pending ? "Sending request…" : "Send to resolution center"}
      </button></div>
    </form>
    </section>
  );
}
