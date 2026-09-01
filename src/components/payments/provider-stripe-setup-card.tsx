"use client";

import Link from "next/link";
import { useActionState } from "react";
import { startStripeOnboarding } from "@/lib/payments/actions";
import {
  initialPaymentActionState,
  type ProviderPaymentSetup,
} from "@/lib/payments/types";
import { PaymentFeedback } from "./payment-feedback";

export function ProviderStripeSetupCard({
  setup,
}: {
  setup: ProviderPaymentSetup;
}) {
  const [state, action, pending] = useActionState(
    startStripeOnboarding,
    initialPaymentActionState,
  );

  if (!setup.configured || !setup.migrationInstalled) {
    return (
      <section className="mt-8 rounded-3xl border border-[#ead6ad] bg-[#fff8e9] p-6 sm:p-7">
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#76531c]">
          Payments: developer setup required
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-brand-dark">
          Stripe Connect is ready to be connected
        </h2>
        <p className="mt-2 max-w-3xl leading-7 text-[#76531c]">
          Add the server-only Stripe and Supabase secret keys, then install the
          payments migration. No bank or identity information will be stored by
          Auxilium.
        </p>
        <Link
          href="/setup?reason=stripe-payments"
          className="mt-5 inline-flex rounded-full border border-[#d8b979] bg-white px-5 py-2.5 text-sm font-semibold text-[#76531c]"
        >
          View developer setup
        </Link>
      </section>
    );
  }

  if (setup.ready) {
    return (
      <section className="mt-8 rounded-3xl border border-[#b9d8c9] bg-[#eef8f2] p-6 sm:p-7">
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-brand">
          Payments: ready
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-brand-dark">
          Stripe payouts are connected
        </h2>
        <p className="mt-2 leading-7 text-muted">
          Customers can pay accepted bookings after you set the final price. You
          receive 95%; Auxilium retains its 5% platform commission.
        </p>
        {setup.message && <p className="mt-3 text-sm text-muted">{setup.message}</p>}
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-3xl border border-[#ead6ad] bg-[#fff8e9] p-6 sm:p-7">
      <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#76531c]">
        Payments: action needed
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-brand-dark">
        {setup.hasAccount ? "Finish Stripe payout setup" : "Connect Stripe payouts"}
      </h2>
      <p className="mt-2 max-w-3xl leading-7 text-[#76531c]">
        Stripe securely collects the required business, identity, and bank details.
        Auxilium never receives those sensitive details.
      </p>
      {setup.requirementsDueCount > 0 && (
        <p className="mt-3 text-sm font-semibold text-[#76531c]">
          {setup.requirementsDueCount} Stripe {setup.requirementsDueCount === 1 ? "item is" : "items are"} still required.
        </p>
      )}
      <form action={action} className="mt-5 space-y-3">
        <PaymentFeedback state={state} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending
            ? "Opening Stripe…"
            : setup.hasAccount
              ? "Continue Stripe setup"
              : "Connect with Stripe"}
        </button>
      </form>
      {setup.message && <p className="mt-3 text-sm text-muted">{setup.message}</p>}
    </section>
  );
}
