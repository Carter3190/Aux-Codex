import type { Metadata } from "next";
import Link from "next/link";
import { getSupportEmail } from "@/lib/support/config";

export const metadata: Metadata = {
  title: "Support center",
  description: "Get help with an Auxilium account, booking, payment, or provider application.",
  alternates: { canonical: "/support" },
};

const supportPaths = [
  {
    title: "Booking or payment issue",
    body: "Open the affected booking in your customer dashboard. Paid bookings include a private resolution form that stays attached to the correct payment.",
    label: "Open customer dashboard",
    href: "/dashboard/customer",
  },
  {
    title: "Provider application or payout",
    body: "Open the provider dashboard to review application status, profile requirements, Stripe onboarding, bookings, and customer resolution requests.",
    label: "Open provider dashboard",
    href: "/dashboard/provider",
  },
  {
    title: "Account access",
    body: "Sign in with the confirmed email address for your account. If you recently registered, check spam or promotions for the confirmation message.",
    label: "Go to sign in",
    href: "/login",
  },
];

export default function SupportPage() {
  const supportEmail = getSupportEmail();

  return (
    <main className="bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-6 py-5 lg:px-10">
          <Link
            href="/"
            className="text-lg font-bold tracking-[0.18em] text-brand-dark"
          >
            AUXILIUM
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-brand-dark transition hover:border-brand"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-14 lg:px-10 lg:py-20">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">
          Auxilium support
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-brand-dark sm:text-5xl">
          Let’s get you to the right place.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
          Choose the path that matches your issue. Keeping booking questions
          inside the dashboard gives the support team the clearest record.
        </p>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {supportPaths.map((path) => (
            <article
              key={path.href}
              className="flex flex-col rounded-3xl border border-border bg-white p-7"
            >
              <h2 className="text-xl font-semibold text-brand-dark">
                {path.title}
              </h2>
              <p className="mt-3 flex-1 leading-7 text-muted">{path.body}</p>
              <Link
                href={path.href}
                className="mt-7 font-semibold text-brand hover:text-brand-dark"
              >
                {path.label} →
              </Link>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-3xl border border-border bg-[#eef5f0] p-7 sm:p-9">
          <h2 className="text-2xl font-semibold text-brand-dark">
            Contact Auxilium
          </h2>
          {supportEmail ? (
            <p className="mt-3 leading-7 text-muted">
              For a question that cannot be submitted through a dashboard,
              email{" "}
              <a
                className="font-semibold text-brand underline underline-offset-4"
                href={`mailto:${supportEmail}`}
              >
                {supportEmail}
              </a>
              . Include the account email and booking ID when relevant, but do
              not send passwords, full card numbers, or identity documents by
              email.
            </p>
          ) : (
            <p className="mt-3 leading-7 text-muted">
              General email support is being prepared for public launch. In the
              meantime, use the signed-in booking resolution flow for payment or
              service issues.
            </p>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-[#ead09c] bg-[#fff8e9] p-7 sm:p-9">
          <h2 className="text-xl font-semibold text-[#704d16]">
            Emergency or immediate danger?
          </h2>
          <p className="mt-3 leading-7 text-[#7b5b2a]">
            Auxilium is not an emergency service. Call 911 or the appropriate
            local emergency authority first. Contact Auxilium afterward so the
            marketplace account and booking can be reviewed.
          </p>
        </section>
      </section>
    </main>
  );
}
