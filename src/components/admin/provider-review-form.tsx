"use client";

import { useActionState } from "react";
import { reviewProviderApplication } from "@/lib/providers/actions";
import {
  initialProviderActionState,
  type ProviderStatus,
} from "@/lib/providers/types";
import { FormFeedback } from "@/components/provider/form-feedback";

export function ProviderReviewForm({
  providerId,
  providerStatus,
  canReview,
}: {
  providerId: string;
  providerStatus: ProviderStatus;
  canReview: boolean;
}) {
  const [state, action, pending] = useActionState(
    reviewProviderApplication,
    initialProviderActionState,
  );

  return (
    <form action={action} className="space-y-4 rounded-2xl bg-[#f4f7f4] p-5">
      <input type="hidden" name="providerId" value={providerId} />
      <label className="block text-sm font-semibold text-foreground">
        Review notes
        <textarea
          name="notes"
          rows={4}
          maxLength={2000}
          className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          placeholder="Required when rejecting; visible to the provider."
        />
        {state.fieldErrors?.notes?.[0] && (
          <span className="mt-2 block font-normal text-red-700">
            {state.fieldErrors.notes[0]}
          </span>
        )}
      </label>
      <FormFeedback state={state} />
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending || !canReview || providerStatus === "approved"}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Approve provider
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending || !canReview}
          className="rounded-full border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Return with notes
        </button>
      </div>
      {!canReview && (
        <p className="text-xs leading-5 text-muted">
          This application cannot be reviewed until the provider completes every
          section and submits it.
        </p>
      )}
    </form>
  );
}
