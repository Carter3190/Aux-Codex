"use client";

import { useActionState, useState } from "react";
import { reviewProviderCredential } from "@/lib/providers/actions";
import {
  initialProviderActionState,
  type CredentialReviewStatus,
} from "@/lib/providers/types";
import { FormFeedback } from "@/components/provider/form-feedback";
import styles from "@/components/marketplace/booking-forms.module.css";

export function ProviderCredentialReviewForm({
  credentialId,
  reviewStatus,
  reviewNotes,
}: {
  credentialId: string;
  reviewStatus: CredentialReviewStatus;
  reviewNotes: string;
}) {
  const [state, action, pending] = useActionState(
    reviewProviderCredential,
    initialProviderActionState,
  );
  const [decision, setDecision] = useState("approved");

  return (
    <form action={action} className={`${styles.form} ${styles.divided}`}>
      <input type="hidden" name="credentialId" value={credentialId} />
      <label className={styles.field}>
        Credential review notes
        <textarea
          name="notes"
          rows={4}
          maxLength={1000}
          defaultValue={reviewNotes}
          className={styles.control}
          placeholder="Required when returning this document."
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
          disabled={pending}
          onClick={() => setDecision("approved")}
          className={styles.primary}
        >
          {reviewStatus === "approved" ? "Confirm approval" : "Approve document"}
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending || reviewStatus === "rejected"}
          onClick={() => setDecision("rejected")}
          className={`${styles.secondary} ${styles.danger}`}
        >
          Return document
        </button>
      </div>
    </form>
  );
}
