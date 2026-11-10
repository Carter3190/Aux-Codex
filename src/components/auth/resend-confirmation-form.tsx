"use client";

import { useActionState, useEffect, useState } from "react";
import { resendConfirmation } from "@/lib/auth/actions";
import { initialConfirmationState } from "@/lib/auth/types";
import styles from "./auth.module.css";

export function ResendConfirmationForm() {
  const [email, setEmail] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [state, action, pending] = useActionState(async (previousState: typeof initialConfirmationState, formData: FormData) => {
    const result = await resendConfirmation(previousState, formData);
    setRemaining(result.retryAfterSeconds ?? 0);
    return result;
  }, initialConfirmationState);

  useEffect(() => {
    if (remaining <= 0) return;
    const timeout = window.setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [remaining]);

  return (
    <form action={action} className={styles.form} aria-label="Request a new confirmation link">
      <label className={styles.field} htmlFor="confirmation-email">
        Email address
        <input id="confirmation-email" name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)}
          aria-describedby={state.fieldErrors?.email ? "confirmation-email-error" : undefined} />
        {state.fieldErrors?.email && <span id="confirmation-email-error" className={styles.error}>{state.fieldErrors.email[0]}</span>}
      </label>
      <button type="submit" className={styles.primary} disabled={pending || remaining > 0}>
        {pending ? "Requesting link…" : remaining > 0 ? `Send link again (${remaining}s)` : "Send link again"}
      </button>
      {state.message && <p className={styles.status} role="status" aria-live="polite">{state.message}</p>}
    </form>
  );
}
