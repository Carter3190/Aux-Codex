"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { startStripeOnboarding } from "@/lib/payments/actions";
import { initialPaymentActionState, type ProviderPaymentSetup } from "@/lib/payments/types";
import { providerStripeStatus, stripeSetupLabels } from "@/lib/payments/stripe-setup-status";
import { PaymentFeedback } from "./payment-feedback";
import styles from "./provider-stripe-setup-card.module.css";

export function ProviderStripeSetupCard({ setup }: { setup: ProviderPaymentSetup }) {
  const [state, action, pending] = useActionState(startStripeOnboarding, initialPaymentActionState);
  const headingId = useId();
  const status = providerStripeStatus(setup);
  const unavailable = status === "unavailable";
  const title = {
    not_started: "Connect Stripe payments",
    incomplete: "Finish Stripe setup",
    pending: "Stripe is reviewing your information",
    action_required: "Review your Stripe account",
    ready: "Stripe connected",
    unknown: "Check your Stripe status",
    unavailable: "Payment setup needs assistance",
  }[status];

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <div><p className={styles.eyebrow}>Stripe payments</p><h2 id={headingId}>{title}</h2></div>
        <span className={styles.badge} data-status={status} role="status">{stripeSetupLabels[status]}</span>
      </div>
      {status === "ready" ? (
        <p className={styles.description}>
          Customers pay after you confirm the agreed price and mark the work complete.
          Auxilium’s commission stays at 5%. Stripe deposits available earnings after
          processing fees according to your payout schedule.
        </p>
      ) : status === "pending" ? (
        <p className={styles.description}>
          Thank you, your information has been submitted to Stripe. Please allow
          3–5 business days for document review. Review times can vary, and Stripe
          may request additional information.
        </p>
      ) : status === "unknown" ? (
        <p className={styles.description}>
          We could not refresh your Stripe status. Your last saved details show
          {setup.ready ? " payments were enabled" : " payment setup was not yet complete"}.
          Review your Stripe account or refresh this page to check again.
        </p>
      ) : status === "action_required" ? (
        <p className={styles.description}>
          Stripe needs additional information or an update to your account.
          Open Stripe to review what is required.
        </p>
      ) : unavailable ? (
        <p className={styles.description}>
          Payment setup is temporarily unavailable. Contact Auxilium support for help.
        </p>
      ) : (
        <p className={styles.description}>
          Stripe securely collects your business, identity, and bank details.
          Complete the required information to receive customer payments and bank deposits.
        </p>
      )}
      {setup.requirementsDueCount > 0 && status !== "unknown" && (
        <p className={styles.note}>
          {setup.requirementsDueCount} Stripe {setup.requirementsDueCount === 1 ? "item is" : "items are"} still required.
        </p>
      )}
      {unavailable ? (
        <Link href="/support" className={styles.secondary}>Contact support</Link>
      ) : status !== "ready" && (
        <form action={action} className={styles.actions}>
          <PaymentFeedback state={state} />
          <button type="submit" disabled={pending} className={styles.primary}>
            {pending ? "Opening Stripe…" : !setup.hasAccount ? "Connect with Stripe" :
              status === "pending" || status === "unknown" || status === "action_required" ? "Review Stripe setup" : "Continue Stripe setup"}
          </button>
        </form>
      )}
      {setup.message && status !== "unknown" && <p className={styles.note}>{setup.message}</p>}
    </section>
  );
}
