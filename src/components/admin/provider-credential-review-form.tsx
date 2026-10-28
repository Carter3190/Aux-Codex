"use client";

import { useActionState } from "react";
import { reviewProviderCredential } from "@/lib/providers/actions";
import {
  initialProviderActionState,
  type CredentialReviewStatus,
} from "@/lib/providers/types";
import { FormFeedback } from "@/components/provider/form-feedback";

export function ProviderCredentialReviewForm({
  credentialId,
  reviewStatus,
  reviewNotes,
}: {
  credentialId: string;
  reviewStatus: CredentialReviewStatus;
  reviewNotes: string;
}) {
  const [state, action, pending] = useActionState(
    reviewProviderCredential,
    initialProviderActionState,
  );

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-border pt-4">
      <input type="hidden" name="credentialId" value={credentialId} />
      <label className="block text-xs font-semibold text-foreground">
        Credential review notes
        <textarea
          name="notes"
          rows={2}
          maxLength={1000}
          defaultValue={reviewNotes}
          className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          placeholder="Required when returning this document."
        />
        {state.fieldErrors?.notes?.[0] && (
          <span className="mt-2 block font-normal text-red-700">
            {state.fieldErrors.notes[0]}
          </span>
        )}
      </label>
      <FormFeedback state={state} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending}
          className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {reviewStatus === "approved" ? "Confirm approval" : "Approve document"}
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending || reviewStatus === "rejected"}
          className="rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Return document
        </button>
      </div>
    </form>
  );
}
