"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendBookingMessage } from "@/lib/marketplace/actions";
import { initialMarketplaceActionState } from "@/lib/marketplace/types";

export function MessageComposer({ bookingId }: { bookingId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    sendBookingMessage,
    initialMarketplaceActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="border-t border-border bg-white p-4 sm:p-5">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className="sr-only" htmlFor="message-body">
        Message
      </label>
      <textarea
        id="message-body"
        name="body"
        rows={3}
        required
        maxLength={2000}
        onKeyDown={(event) => {
          if (
            (event.metaKey || event.ctrlKey) &&
            (event.key === "Enter" || event.key === "NumpadEnter")
          ) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-foreground outline-none transition placeholder:text-[#95a099] focus:border-brand focus:ring-4 focus:ring-brand/10"
        placeholder="Write a message…"
      />
      {state.fieldErrors?.body?.[0] && (
        <p className="mt-2 text-sm text-red-700">{state.fieldErrors.body[0]}</p>
      )}
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-[#b9d8c9] bg-[#eef8f2] text-brand-dark"
          }`}
        >
          {state.message}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="hidden text-xs text-muted sm:block">Press ⌘ + Enter to send</p>
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
