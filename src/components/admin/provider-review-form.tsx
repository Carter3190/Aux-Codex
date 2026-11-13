"use client";

import { useActionState, useState } from "react";
import { reviewProviderApplication } from "@/lib/providers/actions";
import {
  initialProviderActionState,
  type ProviderStatus,
} from "@/lib/providers/types";
import { FormFeedback } from "@/components/provider/form-feedback";
import styles from "@/components/marketplace/booking-forms.module.css";

export function ProviderReviewForm({
  providerId,
  providerStatus,
  canReview,
  canApprove,
  approvalRequirements,
}: {
  providerId: string;
  providerStatus: ProviderStatus;
  canReview: boolean;
  canApprove: boolean;
  approvalRequirements: string[];
}) {
  const [state, action, pending] = useActionState(
    reviewProviderApplication,
    initialProviderActionState,
  );
  const [decision, setDecision] = useState("approved");

  return (
    <form action={action} className={`${styles.form} ${styles.section}`}>
      <input type="hidden" name="providerId" value={providerId} />
      <label className={styles.field}>
        Review notes
        <textarea
          name="notes"
          rows={4}
          maxLength={2000}
          className={styles.control}
          placeholder="Required when rejecting; visible to the provider."
        />
        {state.fieldErrors?.notes?.[0] && (
          <span className={styles.fieldError}>
            {state.fieldErrors.notes[0]}
          </span>
        )}
      </label>
      <FormFeedback state={state} tone={decision === "rejected" ? "info" : "success"} />
      <div className={styles.actions}>
        <button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending || !canApprove || providerStatus === "approved"}
          onClick={() => setDecision("approved")}
          className={styles.primary}
        >
          Approve provider
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending || !canReview}
          onClick={() => setDecision("rejected")}
          className={`${styles.secondary} ${styles.danger}`}
        >
          Return with notes
        </button>
      </div>
      {!canReview && (
        <p className={styles.hint}>
          This application cannot be reviewed until the provider completes every
          section and submits it.
        </p>
      )}
      {canReview && !canApprove && providerStatus !== "approved" && (
        <ul className={styles.requirements}>
          {approvalRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
        </ul>
      )}
    </form>
  );
}
