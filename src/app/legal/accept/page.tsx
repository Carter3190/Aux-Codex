import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { acceptCurrentLegalAgreements } from "@/lib/legal/actions";
import { getLegalAcceptanceStatus } from "@/lib/legal/data";
import { SiteHeader } from "@/components/site-header";
import styles from "@/components/legal/legal-pages.module.css";

export const metadata: Metadata = {
  title: "Review updated agreements",
};

const providerPathPattern =
  /^\/providers\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function safeReturnPath(value?: string | string[]) {
  if (
    typeof value !== "string" ||
    value.length > 1000 ||
    value.startsWith("//")
  ) {
    return "/dashboard";
  }

  const isDashboardPath =
    value === "/dashboard" ||
    value.startsWith("/dashboard/") ||
    value.startsWith("/dashboard?");

  return isDashboardPath || providerPathPattern.test(value)
    ? value
    : "/dashboard";
}

export default async function LegalAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
}) {
  const profile = await getCurrentProfile();
  const query = await searchParams;
  const nextPath = safeReturnPath(query.next);
  const errorCode =
    typeof query.error === "string" ? query.error : undefined;
  const status = await getLegalAcceptanceStatus(profile);
  const allDocumentsReviewed =
    status.documents.length > 0 &&
    status.documents.every((document) => document.reviewed);
  const documentTitles = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  }).format(status.documents.map((document) => document.title));

  if (status.migrationReady && status.missing.length === 0) {
    redirect(nextPath);
  }

  return (
    <main className={styles.surface}>
      <SiteHeader />
      <div className={`${styles.container} ${styles.acceptContainer}`}>
        <header className={styles.heading}>
        <p className={styles.eyebrow}>
          Account update
        </p>
        <h1 className={styles.title}>
          Review the current agreements
        </h1>
        <p className={styles.description}>
          Before continuing, open each current document for your {profile.role}{" "}
          account, read to the end, and complete its separate confirmation.
        </p>
        </header>
      <section className={styles.acceptPanel} aria-label="Required agreements">
        {!status.migrationReady ? (
          <div className={styles.warning}>
            The current agreements are temporarily unavailable for review.
          </div>
        ) : (
          <form action={acceptCurrentLegalAgreements}>
            <input type="hidden" name="next" value={nextPath} />
            <div>
              {status.documents.map((agreement) => (
                <div
                  key={`${agreement.key}:${agreement.version}`}
                  className={styles.agreementRow}
                >
                  <div>
                    <h2 className={styles.agreementTitle}>
                      {agreement.title}
                    </h2>
                    <p className={styles.version}>
                      Version {agreement.version}
                    </p>
                    <p
                      className={`${styles.badge} ${agreement.reviewed ? "" : styles.pendingBadge}`}
                    >
                      {agreement.reviewed
                        ? "Review completed"
                        : "Review required"}
                    </p>
                  </div>
                  <Link
                    href={`${agreement.href}?review=1&version=${encodeURIComponent(agreement.version)}&hash=${encodeURIComponent(agreement.contentSha256)}&next=${encodeURIComponent(nextPath)}`}
                    className={styles.secondary}
                  >
                    {agreement.reviewed ? "Review again" : "Review document"}
                  </Link>
                </div>
              ))}
            </div>

            <div className={styles.notice}>
              {allDocumentsReviewed
                ? "All required document reviews are complete. You can now save your final acceptance and continue."
                : `Read each document and check its box to confirm you agree to the ${documentTitles}. Select “Accept and continue” to proceed.`}
            </div>

            {errorCode && (
              <p
                role="alert"
                className={styles.error}
              >
                {errorCode === "reviews"
                  ? "Complete the separate review for every document before continuing."
                  : "We could not record your final acceptance. Please try again."}
              </p>
            )}

            <div className={styles.acceptActions}>
            <button
              type="submit"
              disabled={!allDocumentsReviewed}
              className={styles.primary}
            >
              Accept and continue
            </button>
            <span className={styles.progress}>{status.documents.filter((document) => document.reviewed).length} of {status.documents.length} documents reviewed</span>
            </div>
          </form>
        )}

        {!status.migrationReady && (
          <p className={styles.notice}>
            Check back to review the current agreements. If this message persists, contact the{" "}
            <Link
              href="/support"
            >
              Support Center
            </Link>
            .
          </p>
        )}
      </section>
      </div>
    </main>
  );
}
