"use client";

import { useActionState } from "react";
import { completeBooking } from "@/lib/marketplace/actions";
import { initialMarketplaceActionState } from "@/lib/marketplace/types";

export function BookingCompletionForm({ bookingId, paymentReceived = false }: { bookingId: string; paymentReceived?: boolean }) {
  const [state, action, pending] = useActionState(
    completeBooking,
    initialMarketplaceActionState,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div>
        <p className="font-semibold text-brand-dark">Mark the service complete once the work is finished.</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          {paymentReceived ? "Payment is already confirmed for this visit." : "The agreed price becomes due. The customer pays from their booking; marking complete does not charge them automatically."}
        </p>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-[#d0d0d0] bg-white text-brand-dark"
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
        {pending ? "Saving completion…" : "Mark complete"}
      </button>
    </form>
  );
}
