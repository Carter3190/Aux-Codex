import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Project setup",
};

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const query = await searchParams;
  const configured = isSupabaseConfigured();
  const paymentsReason = query.reason === "stripe-payments";
  const reviewsReason = query.reason === "booking-reviews";
  const resolutionReason = query.reason === "resolution-center";

  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <section className="mx-auto max-w-2xl rounded-3xl border border-border bg-white p-8 shadow-[0_24px_70px_rgba(27,62,48,0.1)] sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">
          Developer setup
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand-dark">
          {resolutionReason
            ? "Install the booking resolution center."
            : reviewsReason
            ? "Install completed bookings and verified reviews."
            : paymentsReason
            ? "Connect the secure payment services."
            : configured
              ? "Supabase credentials are connected."
              : "Connect the Supabase project to continue."}
        </h1>
        <p className="mt-4 leading-7 text-muted">
          {resolutionReason
            ? "Run the resolution-center migration in the Supabase SQL Editor, then return to the dashboard. It adds private customer cases, provider responses, audited admin decisions, refund reconciliation, and Stripe dispute visibility."
            : reviewsReason
            ? "Run the verified-reviews migration in the Supabase SQL Editor, then return to the dashboard. The migration adds the completed booking state, secure review rules, and public provider ratings."
            : paymentsReason
            ? "Add the server-only keys below to .env.local, then run the Stripe payments migration in the Supabase SQL Editor. Full instructions are included in the repository README."
            : "Add the project URL and publishable key to .env.local, then run the profiles, provider-onboarding, customer-marketplace, and booking-messages migrations in the Supabase SQL Editor. Full instructions are included in the repository README."}
        </p>
        <div className="mt-7 rounded-2xl bg-[#f4f7f4] p-5 font-mono text-sm leading-7 text-brand-dark">
          <p>NEXT_PUBLIC_SUPABASE_URL=</p>
          <p>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=</p>
          {paymentsReason && (
            <>
              <p>SUPABASE_SECRET_KEY=</p>
              <p>STRIPE_SECRET_KEY=</p>
              <p>STRIPE_WEBHOOK_SECRET=</p>
              <p>APP_URL=http://localhost:3000</p>
            </>
          )}
        </div>
        <p className="mt-5 text-sm leading-6 text-muted">
          Never place a Supabase secret key or service-role key in a variable that
          begins with <code>NEXT_PUBLIC_</code>.
        </p>
        {paymentsReason && (
          <p className="mt-3 text-sm leading-6 text-muted">
            Install <code>20260901020000_stripe_connect_payments.sql</code>. Keep
            every value above private except the two existing <code>NEXT_PUBLIC_</code>
            Supabase values.
          </p>
        )}
        {resolutionReason ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            Install <code>20260914000000_booking_resolution_center.sql</code>.
            This migration preserves existing bookings, payments, and reviews.
          </p>
        ) : reviewsReason ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            Install <code>20260910000000_booking_completion_reviews.sql</code>.
            This migration does not alter or remove existing bookings or payments.
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">
            Install every migration in the <code>supabase/migrations</code> folder
            in filename order.
          </p>
        )}
        <Link
          href="/"
          className="mt-7 inline-flex rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
