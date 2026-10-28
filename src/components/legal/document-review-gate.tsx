"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { completeLegalDocumentReview } from "@/lib/legal/actions";
import type { LegalAgreementKey } from "@/lib/legal/agreements";

function CompleteReviewButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={!enabled || pending}
      className="mt-5 w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving review…" : "Complete document review"}
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
      className="border-t border-border pt-8"
    >
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      <p className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">
        Required document review
      </p>
      <h2
        id={`${documentKey}-review-heading`}
        className="mt-3 text-2xl font-semibold tracking-tight text-brand-dark"
      >
        Confirm your review
      </h2>
      <p className="mt-3 leading-7 text-muted" role="status" aria-live="polite">
        {reachedEnd
          ? "You reached the end of this document. You can now confirm your review."
          : "Read to the end of this document to unlock the confirmation."}
      </p>

      <form action={completeLegalDocumentReview} className="mt-5">
        <input type="hidden" name="documentKey" value={documentKey} />
        <input type="hidden" name="documentVersion" value={documentVersion} />
        <input type="hidden" name="contentSha256" value={contentSha256} />
        <input type="hidden" name="next" value={nextPath} />

        <label
          className={`flex items-start gap-3 rounded-2xl border border-border bg-[#fafafa] p-5 transition-opacity ${
            reachedEnd ? "cursor-pointer" : "cursor-not-allowed opacity-55"
          }`}
        >
          <input
            type="checkbox"
            name="confirmation"
            value="accepted"
            required
            disabled={!reachedEnd}
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-black"
          />
          <span className="text-sm leading-6 text-muted">{affirmation}</span>
        </label>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
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
