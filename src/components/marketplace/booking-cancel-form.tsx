"use client";

import { useActionState } from "react";
import { cancelBooking } from "@/lib/marketplace/actions";
import { initialMarketplaceActionState } from "@/lib/marketplace/types";

export function BookingCancelForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    cancelBooking,
    initialMarketplaceActionState,
  );

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`mb-3 rounded-xl border px-4 py-3 text-sm ${
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-[#b9d8c9] bg-[#eef8f2] text-brand-dark"
          }`}
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-red-300 hover:text-red-700 disabled:opacity-50"
      >
        {pending ? "Cancelling…" : "Cancel request"}
      </button>
    </form>
  );
}
