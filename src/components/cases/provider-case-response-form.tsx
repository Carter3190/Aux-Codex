"use client";

import { useActionState } from "react";
import { respondToBookingCase } from "@/lib/cases/actions";
import { initialCaseActionState } from "@/lib/cases/types";
import { CaseFeedback } from "./case-feedback";

export function ProviderCaseResponseForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(
    respondToBookingCase,
    initialCaseActionState,
  );

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="caseId" value={caseId} />
      <label className="block text-sm font-semibold text-foreground">
        Your response for Auxilium
        <textarea
          name="response"
          rows={4}
          minLength={10}
          maxLength={4000}
          required
          className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          placeholder="Explain what happened and whether you agree with the requested resolution."
        />
      </label>
      {state.fieldErrors?.response?.[0] && (
        <p className="text-sm text-red-700">{state.fieldErrors.response[0]}</p>
      )}
      <CaseFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-[#eef6f1] disabled:opacity-50"
      >
        {pending ? "Sending response…" : "Submit provider response"}
      </button>
    </form>
  );
}
