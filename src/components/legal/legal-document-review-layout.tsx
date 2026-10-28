"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import type { LegalAgreementKey } from "@/lib/legal/agreements";
import { DocumentReviewGate } from "./document-review-gate";

const sha256Pattern = /^[0-9a-f]{64}$/;

export function LegalDocumentReviewLayout({
  children,
  documentKey,
  affirmation,
}: {
  children: ReactNode;
  documentKey: LegalAgreementKey;
  affirmation: string;
}) {
  const searchParams = useSearchParams();
  const reviewMode = searchParams.get("review") === "1";

  if (!reviewMode) return children;

  const nextPath = searchParams.get("next") ?? "/dashboard";
  const documentVersion = searchParams.get("version") ?? "";
  const contentSha256 = searchParams.get("hash") ?? "";
  const error = searchParams.get("error") ?? undefined;
  const bindingIsPresent =
    documentVersion.length > 0 && sha256Pattern.test(contentSha256);
  const acceptancePath = `/legal/accept?next=${encodeURIComponent(nextPath)}`;

  return (
    <>
      {children}
      <section
        aria-label="Required legal document review"
        className="bg-[#f7f7f5] px-6 pb-14 sm:pb-20"
      >
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-white p-7 shadow-[0_24px_70px_rgba(0,0,0,0.08)] sm:p-10">
          {!bindingIsPresent || error === "stale" ? (
            <section aria-labelledby={`${documentKey}-review-unavailable`}>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">
                Required document review
              </p>
              <h2
                id={`${documentKey}-review-unavailable`}
                className="mt-3 text-2xl font-semibold tracking-tight text-brand-dark"
              >
                Open the current document version
              </h2>
              <p
                role="alert"
                className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
              >
                This review link is incomplete or the document changed after
                it was opened. Return to the agreement review page and open the
                current version.
              </p>
              <Link
                href={acceptancePath}
                className="mt-5 inline-flex rounded-full bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-dark"
              >
                Return to agreement review
              </Link>
            </section>
          ) : (
            <DocumentReviewGate
              key={`${documentVersion}:${contentSha256}`}
              documentKey={documentKey}
              documentVersion={documentVersion}
              contentSha256={contentSha256}
              affirmation={affirmation}
              nextPath={nextPath}
              error={error}
            />
          )}
        </div>
      </section>
    </>
  );
}
