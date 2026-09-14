"use client";

import { useActionState } from "react";
import { denyBookingCase, refundBookingCase } from "@/lib/cases/actions";
import { initialCaseActionState } from "@/lib/cases/types";
import { CaseFeedback } from "./case-feedback";

function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export function AdminCaseDecisionForms({
  caseId,
  requestedRefundCents,
  remainingRefundCents,
}: {
  caseId: string;
  requestedRefundCents: number;
  remainingRefundCents: number;
}) {
  const [refundState, refundAction, refundPending] = useActionState(
    refundBookingCase,
    initialCaseActionState,
  );
  const [denyState, denyAction, denyPending] = useActionState(
    denyBookingCase,
    initialCaseActionState,
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form
        action={refundAction}
        className="space-y-4 rounded-2xl border border-[#b9d8c9] bg-[#f4faf6] p-5"
      >
        <input type="hidden" name="caseId" value={caseId} />
        <div>
          <p className="font-semibold text-brand-dark">Approve a Stripe refund</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            This sends money back to the customer and proportionally reverses
            both the provider transfer and Auxilium’s application fee.
          </p>
        </div>
        <label className="block text-sm font-semibold text-foreground">
          Refund amount (USD)
          <input
            name="amount"
            type="number"
            min="1"
            max={dollars(remainingRefundCents)}
            step="0.01"
            defaultValue={dollars(
              Math.min(requestedRefundCents, remainingRefundCents),
            )}
            required
            className="mt-2 block w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
          <span className="mt-1 block font-normal text-muted">
            {dollars(remainingRefundCents)} USD remains refundable.
          </span>
        </label>
        <label className="block text-sm font-semibold text-foreground">
          Decision notes
          <textarea
            name="notes"
            rows={3}
            minLength={10}
            maxLength={4000}
            required
            className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            placeholder="Explain why this amount is being refunded."
          />
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-[#b9d8c9] bg-white p-3 text-sm leading-6 text-foreground">
          <input
            type="checkbox"
            name="confirmation"
            value="confirmed"
            required
            className="mt-1 h-4 w-4 accent-[#17664c]"
          />
          <span>
            I confirm this immediately creates a Stripe refund for the amount shown.
          </span>
        </label>
        {Object.values(refundState.fieldErrors ?? {}).flat()[0] && (
          <p className="text-sm text-red-700">
            {Object.values(refundState.fieldErrors ?? {}).flat()[0]}
          </p>
        )}
        <CaseFeedback state={refundState} />
        <button
          type="submit"
          disabled={refundPending || remainingRefundCents < 100}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {refundPending ? "Issuing refund…" : "Confirm and issue refund"}
        </button>
      </form>

      <form
        action={denyAction}
        className="space-y-4 rounded-2xl border border-border bg-[#f7f8f6] p-5"
      >
        <input type="hidden" name="caseId" value={caseId} />
        <div>
          <p className="font-semibold text-brand-dark">Deny the request</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            This closes the request without moving money. The note is visible to
            the customer and provider.
          </p>
        </div>
        <label className="block text-sm font-semibold text-foreground">
          Decision notes
          <textarea
            name="notes"
            rows={4}
            minLength={10}
            maxLength={4000}
            required
            className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            placeholder="Explain why no refund is being issued."
          />
        </label>
        {denyState.fieldErrors?.notes?.[0] && (
          <p className="text-sm text-red-700">{denyState.fieldErrors.notes[0]}</p>
        )}
        <CaseFeedback state={denyState} />
        <button
          type="submit"
          disabled={denyPending}
          className="rounded-full border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          {denyPending ? "Saving decision…" : "Deny with notes"}
        </button>
      </form>
    </div>
  );
}
