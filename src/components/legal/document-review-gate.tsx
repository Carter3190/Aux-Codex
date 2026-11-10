"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { completeLegalDocumentReview } from "@/lib/legal/actions";
import type { LegalAgreementKey } from "@/lib/legal/agreements";
import styles from "./legal-pages.module.css";

function CompleteReviewButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={!enabled || pending}
      className={`${styles.primary} ${styles.reviewSubmit}`}
    >
      {pending ? "Saving review…" : "Confirm and return"}
    </button>
  );
}

export function DocumentReviewGate({
  documentKey,
  documentVersion,
  contentSha256,
  affirmation,
  nextPath,
  error,
}: {
  documentKey: LegalAgreementKey;
  documentVersion: string;
  contentSha256: string;
  affirmation: string;
  nextPath: string;
  error?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || reachedEnd) return;

    const checkPosition = () => {
      if (sentinel.getBoundingClientRect().top <= window.innerHeight) {
        setReachedEnd(true);
      }
    };
    window.addEventListener("scroll", checkPosition, { passive: true });
    window.addEventListener("resize", checkPosition);
    checkPosition();

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              setReachedEnd(true);
            }
          });

    observer?.observe(sentinel);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", checkPosition);
      window.removeEventListener("resize", checkPosition);
    };
  }, [reachedEnd]);

  return (
    <section
      aria-labelledby={`${documentKey}-review-heading`}
    >
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      <p className={styles.eyebrow}>
        Required document review
      </p>
      <h2
        id={`${documentKey}-review-heading`}
        className={styles.reviewTitle}
      >
        Confirm your review
      </h2>
      <p className={styles.reviewCopy} role="status" aria-live="polite">
        {reachedEnd
          ? "You reached the end of this document. You can now confirm your review."
          : "Read to the end of this document to unlock the confirmation."}
      </p>

      <form action={completeLegalDocumentReview} className={styles.form}>
        <input type="hidden" name="documentKey" value={documentKey} />
        <input type="hidden" name="documentVersion" value={documentVersion} />
        <input type="hidden" name="contentSha256" value={contentSha256} />
        <input type="hidden" name="next" value={nextPath} />

        <label
          className={`${styles.check} ${reachedEnd ? "" : styles.checkDisabled}`}
        >
          <input
            type="checkbox"
            name="confirmation"
            value="accepted"
            required
            disabled={!reachedEnd}
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>{affirmation}</span>
        </label>

        {error && (
          <p
            role="alert"
            className={styles.error}
          >
            {error === "confirmation"
              ? "Reach the end of the document and check the confirmation before continuing."
              : error === "stale"
                ? "This document changed after it was opened. Return to the agreement review page and open the current version before confirming."
                : "We could not save this document review. Please try again."}
          </p>
        )}

        <CompleteReviewButton enabled={reachedEnd && confirmed} />
      </form>
    </section>
  );
}
