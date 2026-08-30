"use client";

import { useActionState } from "react";
import { submitProviderApplication } from "@/lib/providers/actions";
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
    <form action={action} className="rounded-3xl border border-brand/20 bg-[#eaf5ef] p-6 sm:p-8">
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
