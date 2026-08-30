"use client";

import { useActionState } from "react";
import { saveProviderAvailability } from "@/lib/providers/actions";
import { weekdays } from "@/lib/providers/presentation";
import {
  initialProviderActionState,
  type ProviderAvailability,
} from "@/lib/providers/types";
import { FormFeedback } from "./form-feedback";

export function ProviderAvailabilityForm({
  availability,
}: {
  availability: ProviderAvailability[];
}) {
  const [state, action, pending] = useActionState(
    saveProviderAvailability,
    initialProviderActionState,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border">
        {availability.map((day) => (
          <div
            key={day.weekday}
            className="grid gap-3 border-b border-border bg-white p-4 last:border-b-0 sm:grid-cols-[180px_1fr_1fr] sm:items-center"
          >
            <label className="flex items-center gap-3 font-semibold text-brand-dark">
              <input
                type="checkbox"
                name={`available_${day.weekday}`}
                defaultChecked={day.isAvailable}
                className="h-4 w-4 accent-brand"
              />
              {weekdays[day.weekday]}
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted">
              Start
              <input
                type="time"
                name={`start_${day.weekday}`}
                defaultValue={day.startTime ?? "09:00"}
                className="mt-1 block w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted">
              End
              <input
                type="time"
                name={`end_${day.weekday}`}
                defaultValue={day.endTime ?? "17:00"}
                className="mt-1 block w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>
        ))}
      </div>
      <FormFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save availability"}
      </button>
    </form>
  );
}
