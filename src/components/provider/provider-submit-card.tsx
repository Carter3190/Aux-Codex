"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitProviderApplication } from "@/lib/providers/actions";
import { LEGAL_AGREEMENTS } from "@/lib/legal/agreements";
import {
  initialProviderActionState,
  type ProviderCompletion,
} from "@/lib/providers/types";
import { FormFeedback } from "./form-feedback";

export function ProviderSubmitCard({
  completion,
  submittedAt,
}: {
  completion: ProviderCompletion;
  submittedAt: string | null;
}) {
  const [state, action, pending] = useActionState(
    submitProviderApplication,
    initialProviderActionState,
  );

  return (
    <form action={action} className="rounded-3xl border border-brand/20 bg-[#f2f2f2] p-6 sm:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">
        Final step
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-brand-dark">
        {submittedAt ? "Application submitted" : "Submit for Auxilium review"}
      </h2>
      <p className="mt-3 max-w-2xl leading-7 text-muted">
        {submittedAt
          ? `Submitted ${new Date(submittedAt).toLocaleDateString()}. Editing any profile section will return the application to draft review.`
          : completion.isComplete
            ? "Every required section is complete. Submit your information for an administrator to review."
            : `Complete all five sections first. You have finished ${completion.completedCount} of ${completion.totalCount}.`}
      </p>
      <div className="mt-5">
        <FormFeedback state={state} />
      </div>
      {!submittedAt && (
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-white p-4">
          <input
            type="checkbox"
            name="providerLegalConfirmation"
            value="accepted"
            required
            className="mt-1 h-4 w-4 shrink-0 accent-black"
          />
          <span className="text-sm leading-6 text-muted">
            I have reviewed and agree to the current{" "}
            <Link
              href="/provider-agreement"
              target="_blank"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Provider Agreement
            </Link>{" "}
            (version {LEGAL_AGREEMENTS.providerAgreement.version}) and{" "}
            <Link
              href="/provider-standards"
              target="_blank"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Provider Standards
            </Link>{" "}
            (version {LEGAL_AGREEMENTS.providerStandards.version}). I accept
            responsibility for my services and for every employee,
            contractor, or subcontractor I send to a customer, and I confirm
            that all licenses, credentials, and insurance required for my
            services are current.
          </span>
        </label>
      )}
      <button
        type="submit"
        disabled={pending || !completion.isComplete || Boolean(submittedAt)}
        className="mt-5 rounded-full bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Submitting…" : submittedAt ? "Under review" : "Submit application"}
      </button>
    </form>
  );
}
