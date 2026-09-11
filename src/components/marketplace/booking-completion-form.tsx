"use client";

import { useActionState } from "react";
import { completeBooking } from "@/lib/marketplace/actions";
import { initialMarketplaceActionState } from "@/lib/marketplace/types";

export function BookingCompletionForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    completeBooking,
    initialMarketplaceActionState,
  );

  return (
    <form action={action} className="mt-5 space-y-3 rounded-2xl border border-[#b9d8c9] bg-[#f4faf6] p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div>
        <p className="font-semibold text-brand-dark">Has the service been completed?</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Marking it complete closes the active booking and lets the customer leave a verified review.
        </p>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-[#b9d8c9] bg-white text-brand-dark"
          }`}
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Saving completion…" : "Mark service complete"}
      </button>
    </form>
  );
}
