"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendBookingMessage } from "@/lib/marketplace/actions";
import { initialMarketplaceActionState } from "@/lib/marketplace/types";
import styles from "./messages.module.css";

export function MessageComposer({ bookingId }: { bookingId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    sendBookingMessage,
    initialMarketplaceActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className={styles.composer}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <label htmlFor="message-body">
        Your message
      </label>
      <textarea
        id="message-body"
        name="body"
        rows={3}
        required
        maxLength={2000}
        onKeyDown={(event) => {
          if (
            (event.metaKey || event.ctrlKey) &&
            (event.key === "Enter" || event.key === "NumpadEnter")
          ) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Write a message…"
      />
      {state.fieldErrors?.body?.[0] && (
        <p className={styles.fieldError}>{state.fieldErrors.body[0]}</p>
      )}
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`${styles.feedback} ${state.status === "error" ? styles.feedbackError : ""}`}
        >
          {state.message}
        </p>
      )}
      <div className={styles.composeActions}>
        <p>Press ⌘ + Enter to send</p>
        <button
          type="submit"
          disabled={pending}
          className={styles.primaryButton}
        >
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
