"use client";

import { NumberField } from "@/components/ui/fields";
import { useActionState } from "react";
import { denyBookingCase, refundBookingCase } from "@/lib/cases/actions";
import { initialCaseActionState } from "@/lib/cases/types";
import { CaseFeedback } from "./case-feedback";
import styles from "@/components/marketplace/booking-forms.module.css";

function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export function AdminCaseDecisionForms({
  caseId,
  requestedRefundCents,
  remainingRefundCents,
}: {
  caseId: string;
  requestedRefundCents: number;
  remainingRefundCents: number;
}) {
  const [refundState, refundAction, refundPending] = useActionState(
    refundBookingCase,
    initialCaseActionState,
  );
  const [denyState, denyAction, denyPending] = useActionState(
    denyBookingCase,
    initialCaseActionState,
  );

  return (
    <div className={styles.decisionGrid}>
      <form
        action={refundAction}
        className={`${styles.form} ${styles.section}`}
      >
        <input type="hidden" name="caseId" value={caseId} />
        <div>
          <h3 className={styles.heading}>Approve a Stripe refund</h3>
          <p className={styles.description}>
            This refunds the provider’s Stripe charge and proportionally refunds
            Auxilium’s application fee.
          </p>
        </div>
        <label className={styles.field}>
          Refund amount (USD)
          <NumberField
            name="amount"
            min="1"
            max={dollars(remainingRefundCents)}
            step="0.01"
            defaultValue={dollars(
              Math.min(requestedRefundCents, remainingRefundCents),
            )}
            required
            className={styles.control}
          />
          <span className={styles.hint}>
            {dollars(remainingRefundCents)} USD remains refundable.
          </span>
        </label>
        <label className={styles.field}>
          Decision notes
          <textarea
            name="notes"
            rows={3}
            minLength={10}
            maxLength={4000}
            required
            className={styles.control}
            placeholder="Explain why this amount is being refunded."
          />
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="confirmation"
            value="confirmed"
            required
          />
          <span>
            I confirm this immediately creates a Stripe refund for the amount shown.
          </span>
        </label>
        {Object.values(refundState.fieldErrors ?? {}).flat()[0] && (
          <p className={styles.fieldError}>
            {Object.values(refundState.fieldErrors ?? {}).flat()[0]}
          </p>
        )}
        <CaseFeedback state={refundState} />
        <button
          type="submit"
          disabled={refundPending || remainingRefundCents < 100}
          className={styles.primary}
        >
          {refundPending ? "Issuing refund…" : "Confirm and issue refund"}
        </button>
      </form>

      <form
        action={denyAction}
        className={`${styles.form} ${styles.section}`}
      >
        <input type="hidden" name="caseId" value={caseId} />
        <div>
          <h3 className={styles.heading}>Deny the request</h3>
          <p className={styles.description}>
            This closes the request without moving money. The note is visible to
            the customer and provider.
          </p>
        </div>
        <label className={styles.field}>
          Decision notes
          <textarea
            name="notes"
            rows={4}
            minLength={10}
            maxLength={4000}
            required
            className={styles.control}
            placeholder="Explain why no refund is being issued."
          />
        </label>
        {denyState.fieldErrors?.notes?.[0] && (
          <p className={styles.fieldError}>{denyState.fieldErrors.notes[0]}</p>
        )}
        <CaseFeedback state={denyState} tone="info" />
        <button
          type="submit"
          disabled={denyPending}
          className={`${styles.secondary} ${styles.danger}`}
        >
          {denyPending ? "Saving decision…" : "Deny with notes"}
        </button>
      </form>
    </div>
  );
}
