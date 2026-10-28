import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { acceptCurrentLegalAgreements } from "@/lib/legal/actions";
import { getLegalAcceptanceStatus } from "@/lib/legal/data";

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
  const status = await getLegalAcceptanceStatus(profile);

  if (status.migrationReady && status.missing.length === 0) {
    redirect(nextPath);
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-6 py-14 sm:py-20">
      <section className="mx-auto max-w-3xl rounded-3xl border border-border bg-white p-7 shadow-[0_24px_70px_rgba(0,0,0,0.08)] sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
          Account update
        </p>
        <h1 className="mt-4 text-4xl font-normal tracking-[-0.04em] text-foreground sm:text-5xl">
          Review the current agreements
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-muted">
          Before continuing, please review and affirm the current documents
          that apply to your {profile.role} account. Your acceptance is saved
          with the document version and a server timestamp.
        </p>

        {!status.migrationReady ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            The versioned agreement migration still needs to be installed. No
            acceptance was requested or recorded yet.
          </div>
        ) : (
          <form action={acceptCurrentLegalAgreements} className="mt-8">
            <input type="hidden" name="next" value={nextPath} />
            <div className="overflow-hidden rounded-2xl border border-border">
              {status.missing.map((agreement, index) => (
                <div
                  key={`${agreement.key}:${agreement.version}`}
                  className={`flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between ${
                    index > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {agreement.title}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Version {agreement.version}
                    </p>
                  </div>
                  <Link
                    href={agreement.href}
                    target="_blank"
                    rel="noreferrer"
                    className="w-fit text-sm font-semibold text-foreground underline underline-offset-4"
                  >
                    Review document
                  </Link>
                </div>
              ))}
            </div>

            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-[#fafafa] p-5">
              <input
                type="checkbox"
                name="confirmation"
                value="accepted"
                required
                className="mt-1 h-4 w-4 shrink-0 accent-black"
              />
              <span className="text-sm leading-6 text-muted">
                I have reviewed each current document listed above and agree
                to or acknowledge it, as applicable. I understand that this
                action and its timestamp will be retained as part of
                Auxilium&apos;s legal records.
              </span>
            </label>

            {query.error && (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {query.error === "confirmation"
                  ? "Check the confirmation box before continuing."
                  : "We could not record your acceptance. Please try again."}
              </p>
            )}

            <button
              type="submit"
              className="mt-6 w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white transition hover:bg-brand-dark"
            >
              Accept and continue
            </button>
          </form>
        )}

        {!status.migrationReady && (
          <p className="mt-6 text-sm leading-6 text-muted">
            Dashboard access will resume after the legal-record migration is
            installed. If this message persists, contact the{" "}
            <Link
              href="/support"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Support Center
            </Link>
            .
          </p>
        )}
      </section>
    </main>
  );
}
