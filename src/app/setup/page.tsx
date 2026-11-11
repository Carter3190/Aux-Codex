import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import styles from "@/components/recovery/recovery-pages.module.css";

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
  const riskControlsReason = query.reason === "provider-risk-controls";

  return (
    <main className={styles.page}>
      <section className={styles.setup}>
        <div className={styles.setupHeading}>
        <p className={styles.eyebrow}>
          Developer setup
        </p>
        <h1>
          {riskControlsReason
            ? "Install the provider risk controls."
            : resolutionReason
            ? "Install the booking resolution center."
            : reviewsReason
            ? "Install completed bookings and verified reviews."
            : paymentsReason
            ? "Connect the secure payment services."
            : configured
              ? "Supabase credentials are connected."
              : "Connect the Supabase project to continue."}
        </h1>
        <p className={styles.description}>
          {riskControlsReason
            ? "Run the legal-acceptance, provider-risk, booking-acknowledgement, and document-review migrations in filename order, then return to the provider page. These migrations add versioned agreement records, insurance controls, booking-specific legal acknowledgements, and separate document-review records."
            : resolutionReason
            ? "Run the resolution-center migration in the Supabase SQL Editor, then return to the dashboard. It adds private customer cases, provider responses, audited admin decisions, refund reconciliation, and Stripe dispute visibility."
            : reviewsReason
            ? "Run the verified-reviews migration in the Supabase SQL Editor, then return to the dashboard. The migration adds the completed booking state, secure review rules, and public provider ratings."
            : paymentsReason
            ? "Add the server-only keys below to .env.local, then run the Stripe payments migration in the Supabase SQL Editor. Full instructions are included in the repository README."
            : "Add the project URL and publishable key to .env.local, then run the profiles, provider-onboarding, customer-marketplace, and booking-messages migrations in the Supabase SQL Editor. Full instructions are included in the repository README."}
        </p>
        </div>
        <div className={styles.panel}>
        <div className={styles.configKeys}>
          <p>NEXT_PUBLIC_SUPABASE_URL=</p>
          <p>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=</p>
          {paymentsReason && (
            <>
              <p>SUPABASE_SECRET_KEY=</p>
              <p>STRIPE_SECRET_KEY=</p>
              <p>STRIPE_WEBHOOK_SECRET=</p>
              <p>STRIPE_CONNECT_WEBHOOK_SECRET=</p>
              <p>APP_URL=http://localhost:3000</p>
            </>
          )}
        </div>
        <p className={styles.note}>
          Never place a Supabase secret key or service-role key in a variable that
          begins with <code>NEXT_PUBLIC_</code>.
        </p>
        {paymentsReason && (
          <p className={styles.note}>
            Install <code>20260901020000_stripe_connect_payments.sql</code> and
            then <code>20261002000000_direct_charge_payments.sql</code>. Keep every
            value above private except the two existing <code>NEXT_PUBLIC_</code>
            Supabase values.
          </p>
        )}
        {riskControlsReason ? (
          <p className={styles.note}>
            Install <code>20261026000000_versioned_legal_acceptances.sql</code>,{" "}
            <code>20261026005000_provider_risk_control_cohort.sql</code>,{" "}
            <code>20261026010000_booking_legal_acknowledgement.sql</code>, and{" "}
            <code>20261026020000_provider_risk_controls.sql</code>, followed by{" "}
            <code>20261027000000_legal_document_review_completions.sql</code>.
            These migrations preserve existing bookings, payment records, and
            completed legal acceptances.
          </p>
        ) : resolutionReason ? (
          <p className={styles.note}>
            Install <code>20260914000000_booking_resolution_center.sql</code>.
            This migration preserves existing bookings, payments, and reviews.
          </p>
        ) : reviewsReason ? (
          <p className={styles.note}>
            Install <code>20260910000000_booking_completion_reviews.sql</code>.
            This migration does not alter or remove existing bookings or payments.
          </p>
        ) : (
          <p className={styles.note}>
            Install every migration in the <code>supabase/migrations</code> folder
            in filename order.
          </p>
        )}
        <div className={styles.actions}><Link
          href="/"
          className={styles.primary}
        >
          Return home
        </Link></div>
        </div>
      </section>
    </main>
  );
}
