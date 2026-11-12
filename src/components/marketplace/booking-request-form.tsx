"use client";

import { DateField, SelectField, TimeField } from "@/components/ui/fields";
import Link from "next/link";
import { useActionState } from "react";
import { requestBooking } from "@/lib/marketplace/actions";
import {
  initialMarketplaceActionState,
  type MarketplaceService,
} from "@/lib/marketplace/types";
import { formatPrice } from "@/lib/providers/presentation";

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="mt-2 block text-sm font-normal text-red-700">{message}</span>
  ) : null;
}

export function BookingRequestForm({
  providerId,
  providerName,
  services,
  minimumDate,
}: {
  providerId: string;
  providerName: string;
  services: MarketplaceService[];
  minimumDate: string;
}) {
  const [state, action, pending] = useActionState(
    requestBooking,
    initialMarketplaceActionState,
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="providerId" value={providerId} />
      <label className="block text-sm font-semibold text-foreground">
        Service
        <SelectField name="serviceId" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Choose a service
          </option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} — {formatPrice(service.pricingType, service.priceCents)}
            </option>
          ))}
        </SelectField>
        <FieldError message={state.fieldErrors?.serviceId?.[0]} />
      </label>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-5">
        <label className="text-sm font-semibold text-foreground">
          Requested date
          <DateField
            name="requestedDate"
            min={minimumDate}
            required
            className={inputClass}
          />
          <FieldError message={state.fieldErrors?.requestedDate?.[0]} />
        </label>
        <label className="text-sm font-semibold text-foreground">
          Preferred start time
          <TimeField
            name="requestedTime"
            required
            className={inputClass}
          />
          <FieldError message={state.fieldErrors?.requestedTime?.[0]} />
        </label>
      </div>

      <label className="block text-sm font-semibold text-foreground">
        Service location
        <input
          name="serviceLocation"
          type="text"
          autoComplete="street-address"
          required
          minLength={5}
          maxLength={300}
          className={inputClass}
          placeholder="Address or location where the work is needed"
        />
        <span className="mt-2 block text-xs font-normal leading-5 text-muted">
          This stays private and is shown only to you, the provider, and Auxilium admins.
        </span>
        <FieldError message={state.fieldErrors?.serviceLocation?.[0]} />
      </label>

      <label className="block text-sm font-semibold text-foreground">
        What do you need help with? <span className="font-normal text-muted">(optional)</span>
        <textarea
          name="notes"
          rows={5}
          maxLength={2000}
          className={inputClass}
          placeholder="Share the scope, timing, or any details the provider should know."
        />
        <FieldError message={state.fieldErrors?.notes?.[0]} />
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-border bg-[#f7f7f7] p-4 text-sm leading-6 text-foreground">
        <input
          type="checkbox"
          name="providerResponsibilityAcknowledged"
          value="accepted"
          required
          className="mt-1 h-4 w-4 shrink-0 accent-brand"
        />
        <span>
          I understand that {providerName}, not Auxilium, will perform and be
          responsible for the requested service. If the provider accepts, any
          resulting service agreement will be directly with that provider. I
          agree to Auxilium’s current{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline underline-offset-4"
          >
            Terms of Service
          </Link>
          .
          <FieldError
            message={state.fieldErrors?.providerResponsibilityAcknowledged?.[0]}
          />
        </span>
      </label>

      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-[#d0d0d0] bg-[#f2f2f2] text-brand-dark"
          }`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || services.length === 0}
        className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending request…" : "Agree and send booking request"}
      </button>
    </form>
  );
}
