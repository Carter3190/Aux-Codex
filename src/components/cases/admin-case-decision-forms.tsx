"use client";

import { NumberField } from "@/components/ui/fields";
import { useActionState } from "react";
import { denyBookingCase, refundBookingCase } from "@/lib/cases/actions";
import { initialCaseActionState, type PendingBookingRefund } from "@/lib/cases/types";
import { CaseFeedback } from "./case-feedback";
import styles from "@/components/marketplace/booking-forms.module.css";

function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export function AdminCaseDecisionForms({
  caseId,
  requestedRefundCents,
  remainingRefundCents,
  refundPending: refundInProgress,
  pendingRefund = null,
  decisionNotes = null,
}: {
  caseId: string;
  requestedRefundCents: number;
  remainingRefundCents: number;
  refundPending: boolean;
  pendingRefund?: PendingBookingRefund | null;
  decisionNotes?: string | null;
}) {
  const [refundState, refundAction, refundPending] = useActionState(
    refundBookingCase,
    initialCaseActionState,
  );
  const [denyState, denyAction, denyPending] = useActionState(
    denyBookingCase,
    initialCaseActionState,
  );
  const isExistingRefund = refundInProgress || pendingRefund !== null;
  const existingAmountKnown = pendingRefund && Number.isInteger(pendingRefund.amountCents) && pendingRefund.amountCents >= 100;
  const canReconcile = Boolean(existingAmountKnown && pendingRefund.canRetry);
  const originalNotes = decisionNotes && decisionNotes.trim().length >= 10
    ? decisionNotes : "Reconcile the existing refund status.";

  return (
    <div className={styles.decisionGrid}>
      <form
        action={refundAction}
        className={`${styles.form} ${styles.section}`}
      >
        <input type="hidden" name="caseId" value={caseId} />
        <div>
          <h3 className={styles.heading}>{isExistingRefund ? "Existing Stripe refund" : "Approve a Stripe refund"}</h3>
          <p className={styles.description}>
            {isExistingRefund
              ? pendingRefund?.status === "requires_action"
                ? "Stripe needs an additional step for this refund. Review it in Stripe, then check its status here."
                : "This refund is already in progress. Its original amount and decision notes stay unchanged."
              : "This refunds the provider’s Stripe charge and proportionally refunds Auxillium’s application fee."}
          </p>
          {isExistingRefund && !canReconcile && <p className={styles.hint} role="status">This refund needs a status review in Stripe before another attempt. Contact support to reconcile the existing refund.</p>}
        </div>
        <label className={styles.field}>
          Refund amount (USD)
          {isExistingRefund ? <input
            name="amount"
            value={existingAmountKnown ? dollars(pendingRefund.amountCents) : ""}
            readOnly
            className={styles.control}
            aria-label="Existing refund amount (USD)"
          /> : <NumberField
            name="amount"
            min="1"
            max={dollars(remainingRefundCents)}
            step="0.01"
            defaultValue={dollars(
              Math.min(requestedRefundCents, remainingRefundCents),
            )}
            required
            className={styles.control}
          />}
          <span className={styles.hint}>
            {isExistingRefund ? "The amount is locked to the existing refund." : `${dollars(remainingRefundCents)} USD remains refundable.`}
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
            readOnly={isExistingRefund}
            defaultValue={isExistingRefund ? originalNotes : undefined}
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
            {isExistingRefund ? "I confirm I am checking or retrying only the existing refund for the locked amount shown." : "I confirm this immediately creates a Stripe refund for the amount shown."}
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
          disabled={refundPending || (isExistingRefund ? !canReconcile : remainingRefundCents < 100)}
          className={styles.primary}
        >
          {refundPending ? isExistingRefund ? "Checking refund…" : "Issuing refund…" : isExistingRefund ? pendingRefund?.stripeRefundId ? "Check refund status" : "Retry existing refund" : "Confirm and issue refund"}
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
          {(isExistingRefund || refundPending || refundState.refundPending === true) && (
            <p className={styles.hint} role="status">A refund is being processed. Wait for its status to update before making another decision.</p>
          )}
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
          disabled={denyPending || isExistingRefund || refundPending || refundState.refundPending === true}
          className={`${styles.secondary} ${styles.danger}`}
        >
          {denyPending ? "Saving decision…" : "Deny with notes"}
        </button>
      </form>
    </div>
  );
}
