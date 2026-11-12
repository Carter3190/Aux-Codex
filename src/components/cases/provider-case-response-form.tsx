"use client";

import { useActionState, useId } from "react";
import { respondToBookingCase } from "@/lib/cases/actions";
import { initialCaseActionState } from "@/lib/cases/types";
import { CaseFeedback } from "./case-feedback";
import styles from "./resolution-response.module.css";

export function ProviderCaseResponseForm({ caseId }: { caseId: string }) {
  const responseId = useId();
  const [state, action, pending] = useActionState(
    respondToBookingCase,
    initialCaseActionState,
  );

  return (
    <form action={action} className={`${styles.card} ${styles.form}`} aria-labelledby={`${responseId}-heading`}>
      <input type="hidden" name="caseId" value={caseId} />
      <h3 id={`${responseId}-heading`} className={styles.cardTitle}>Your response</h3>
      <label className={styles.field} htmlFor={responseId}>
        Your response for Auxilium
        <textarea
          id={responseId}
          name="response"
          rows={6}
          minLength={10}
          maxLength={4000}
          required
          className={styles.textarea}
          aria-invalid={Boolean(state.fieldErrors?.response?.[0])}
          aria-describedby={state.fieldErrors?.response?.[0] ? `${responseId}-error` : undefined}
          placeholder="Explain what happened and whether you agree with the requested resolution."
        />
      </label>
      {state.fieldErrors?.response?.[0] && (
        <p id={`${responseId}-error`} className={styles.error}>{state.fieldErrors.response[0]}</p>
      )}
      <CaseFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className={styles.primary}
      >
        {pending ? "Sending response…" : "Submit provider response"}
      </button>
    </form>
  );
}
