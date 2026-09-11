"use client";

import { useActionState } from "react";
import { submitBookingReview } from "@/lib/marketplace/actions";
import { initialMarketplaceActionState } from "@/lib/marketplace/types";

export function BookingReviewForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(
    submitBookingReview,
    initialMarketplaceActionState,
  );

  return (
    <form action={action} className="mt-5 space-y-4 rounded-2xl border border-[#d7dfd9] bg-[#fbfcfa] p-5">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div>
        <p className="font-semibold text-brand-dark">Review your completed service</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Your review will be labeled as coming from a verified Auxilium booking.
        </p>
      </div>
      <label className="block text-sm font-semibold text-foreground">
        Rating
        <select
          name="rating"
          defaultValue="5"
          className="mt-2 block w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
        >
          <option value="5">★★★★★ — Excellent</option>
          <option value="4">★★★★☆ — Good</option>
          <option value="3">★★★☆☆ — Okay</option>
          <option value="2">★★☆☆☆ — Poor</option>
          <option value="1">★☆☆☆☆ — Very poor</option>
        </select>
      </label>
      {state.fieldErrors?.rating?.[0] && (
        <p className="text-sm text-red-700">{state.fieldErrors.rating[0]}</p>
      )}
      <label className="block text-sm font-semibold text-foreground">
        Your experience
        <textarea
          name="body"
          rows={4}
          minLength={10}
          maxLength={2000}
          required
          className="mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
          placeholder="What went well, and what should future customers know?"
        />
      </label>
      {state.fieldErrors?.body?.[0] && (
        <p className="text-sm text-red-700">{state.fieldErrors.body[0]}</p>
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
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Publishing review…" : "Publish verified review"}
      </button>
    </form>
  );
}
