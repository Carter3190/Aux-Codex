"use client";

import { useActionState } from "react";
import { openBookingCase } from "@/lib/cases/actions";
import { initialCaseActionState } from "@/lib/cases/types";
import { CaseFeedback } from "./case-feedback";

function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export function BookingCaseRequestForm({
  bookingId,
  remainingRefundCents,
}: {
  bookingId: string;
  remainingRefundCents: number;
}) {
  const [state, action, pending] = useActionState(
    openBookingCase,
    initialCaseActionState,
  );

  return (
    <form
      action={action}
      className="mt-5 space-y-4 rounded-2xl border border-[#ead6ad] bg-[#fffaf0] p-5"
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <div>
        <p className="font-semibold text-brand-dark">Need help with this paid booking?</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Open a private resolution request. Auxilium reviews the customer’s
          details and the provider’s response before any refund is sent.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-foreground">
          Request type
          <select
            name="category"
            defaultValue="service_issue"
            className="mt-2 block w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          >
            <option value="cancellation">Cancellation request</option>
            <option value="service_issue">Service issue</option>
            <option value="duplicate_charge">Possible duplicate charge</option>
            <option value="other">Other payment issue</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-foreground">
          Requested refund
          <input
            name="amount"
            type="number"
            min="1"
            max={dollars(remainingRefundCents)}
            step="0.01"
            defaultValue={dollars(remainingRefundCents)}
            required
            className="mt-2 block w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
          <span className="mt-1 block font-normal text-muted">
            Up to {dollars(remainingRefundCents)} USD remains refundable.
          </span>
        </label>
      </div>
      {state.fieldErrors?.amount?.[0] && (
        <p className="text-sm text-red-700">{state.fieldErrors.amount[0]}</p>
      )}
      <label className="block text-sm font-semibold text-foreground">
        What happened?
        <textarea
          name="details"
          rows={4}
          minLength={20}
          maxLength={4000}
          required
          className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          placeholder="Describe what happened, what outcome you requested from the provider, and any dates or details that will help us review it."
        />
      </label>
      {state.fieldErrors?.details?.[0] && (
        <p className="text-sm text-red-700">{state.fieldErrors.details[0]}</p>
      )}
      <CaseFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Sending request…" : "Send to resolution center"}
      </button>
    </form>
  );
}
