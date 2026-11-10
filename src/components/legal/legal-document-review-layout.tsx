"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { LEGAL_AGREEMENTS, type LegalAgreementKey } from "@/lib/legal/agreements";
import { DocumentReviewGate } from "./document-review-gate";
import { LegalReviewContext } from "./policy-navigation";
import styles from "./legal-pages.module.css";

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

  const nextPath = searchParams.get("next") ?? "/dashboard";
  const documentVersion = searchParams.get("version") ?? "";
  const contentSha256 = searchParams.get("hash") ?? "";
  const error = searchParams.get("error") ?? undefined;
  const publishedAgreement = Object.values(LEGAL_AGREEMENTS).find(
    (agreement) => agreement.key === documentKey,
  );
  const bindingIsPresent =
    documentVersion === publishedAgreement?.version && sha256Pattern.test(contentSha256);
  const acceptancePath = `/legal/accept?next=${encodeURIComponent(nextPath)}`;

  return (
    <LegalReviewContext.Provider value={{ reviewMode, acceptancePath }}>
    <div className={styles.reviewShell}>
      {children}
      {reviewMode && (
      <section
        id="legal-document-review"
        aria-label="Required legal document review"
        className={styles.reviewSection}
      >
        <div className={styles.reviewCard}>
          {!bindingIsPresent || error === "stale" ? (
            <section aria-labelledby={`${documentKey}-review-unavailable`}>
              <p className={styles.eyebrow}>
                Required document review
              </p>
              <h2
                id={`${documentKey}-review-unavailable`}
                className={styles.reviewTitle}
              >
                Open the current document version
              </h2>
              <p
                role="alert"
                className={styles.warning}
              >
                This review link is incomplete or the document changed after
                it was opened. Return to the agreement review page and open the
                current version.
              </p>
              <Link
                href={acceptancePath}
                className={`${styles.primary} ${styles.reviewSubmit}`}
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
      )}
    </div>
    </LegalReviewContext.Provider>
  );
}
