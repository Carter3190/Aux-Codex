"use client";

import { useActionState } from "react";
import { setBookingPrice } from "@/lib/payments/actions";
import { initialPaymentActionState } from "@/lib/payments/types";
import { PaymentFeedback } from "./payment-feedback";

export function BookingPriceForm({
  bookingId,
  defaultAmountCents,
  hasAgreedPrice = false,
}: {
  bookingId: string;
  defaultAmountCents: number | null;
  hasAgreedPrice?: boolean;
}) {
  const [state, action, pending] = useActionState(
    setBookingPrice,
    initialPaymentActionState,
  );

  return (
    <form action={action} className="mt-5 space-y-3 rounded-2xl bg-[#f4f4f4] p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className="block text-sm font-semibold text-foreground">
        Agreed booking price
        <span className="mt-1 block text-xs font-normal leading-5 text-muted">
          Save the full total agreed with your customer. You can update it again
          before checkout starts. Auxilium’s 5% commission is calculated automatically.
        </span>
        <span className="mt-2 flex items-center rounded-xl border border-border bg-white focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
          <span className="pl-4 text-muted">$</span>
          <input
            name="amount"
            type="number"
            min="1"
            max="1000000"
            step="0.01"
            required
            defaultValue={
              defaultAmountCents === null
                ? undefined
                : (defaultAmountCents / 100).toFixed(2)
            }
            className="w-full rounded-xl bg-transparent px-2 py-3 outline-none"
            placeholder="0.00"
          />
        </span>
      </label>
      {state.fieldErrors?.amount?.[0] && (
        <p className="text-sm text-red-700">{state.fieldErrors.amount[0]}</p>
      )}
      <PaymentFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : hasAgreedPrice ? "Update price" : "Save price"}
      </button>
    </form>
  );
}
