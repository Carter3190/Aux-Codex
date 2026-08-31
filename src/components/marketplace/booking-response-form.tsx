"use client";

import { useActionState } from "react";
import { respondToBooking } from "@/lib/marketplace/actions";
import { initialMarketplaceActionState } from "@/lib/marketplace/types";

export function BookingResponseForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    respondToBooking,
    initialMarketplaceActionState,
  );

  return (
    <form action={action} className="mt-5 space-y-3 rounded-2xl bg-[#f4f7f4] p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className="block text-sm font-semibold text-foreground">
        Response note <span className="font-normal text-muted">(optional)</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          placeholder="Confirm next steps or explain why this time does not work."
        />
      </label>
      {state.fieldErrors?.notes?.[0] && (
        <p className="text-sm text-red-700">{state.fieldErrors.notes[0]}</p>
      )}
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-[#b9d8c9] bg-[#eef8f2] text-brand-dark"
          }`}
        >
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="decision"
          value="accepted"
          disabled={pending}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Accept request
        </button>
        <button
          type="submit"
          name="decision"
          value="declined"
          disabled={pending}
          className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </form>
  );
}
