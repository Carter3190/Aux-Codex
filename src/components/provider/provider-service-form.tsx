"use client";

import { useActionState } from "react";
import {
  addProviderService,
  removeProviderService,
} from "@/lib/providers/actions";
import { formatPrice, labelFromSnakeCase } from "@/lib/providers/presentation";
import {
  initialProviderActionState,
  type ProviderService,
} from "@/lib/providers/types";
import { FormFeedback } from "./form-feedback";

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";

export function ProviderServiceForm({ services }: { services: ProviderService[] }) {
  const [state, action, pending] = useActionState(
    addProviderService,
    initialProviderActionState,
  );

  return (
    <div className="space-y-6">
      {services.length > 0 && (
        <div className="grid gap-3">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-[#fafbf9] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-brand-dark">{service.name}</p>
                  <span className="rounded-full bg-[#eef6f1] px-2.5 py-1 text-xs font-semibold text-brand-dark">
                    {labelFromSnakeCase(service.pricingType)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatPrice(service.pricingType, service.priceCents)}
                  {service.description ? ` · ${service.description}` : ""}
                </p>
              </div>
              <form action={removeProviderService}>
                <input type="hidden" name="serviceId" value={service.id} />
                <button
                  type="submit"
                  className="text-sm font-semibold text-red-700 hover:text-red-900"
                >
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <form action={action} className="space-y-4 rounded-2xl bg-[#f4f7f4] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-foreground">
            Service name
            <input
              name="name"
              required
              maxLength={80}
              className={inputClass}
              placeholder="Furniture assembly"
            />
            {state.fieldErrors?.name?.[0] && (
              <span className="mt-2 block font-normal text-red-700">
                {state.fieldErrors.name[0]}
              </span>
            )}
          </label>
          <label className="text-sm font-semibold text-foreground">
            Pricing method
            <select name="pricingType" className={inputClass} defaultValue="hourly">
              <option value="hourly">Hourly</option>
              <option value="fixed">Fixed price</option>
              <option value="starting_at">Starting at</option>
              <option value="quote">Contact for quote</option>
            </select>
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <label className="text-sm font-semibold text-foreground">
            Short description
            <input
              name="description"
              maxLength={500}
              className={inputClass}
              placeholder="What is included in this service?"
            />
          </label>
          <label className="text-sm font-semibold text-foreground">
            Price in dollars
            <input
              name="price"
              type="number"
              min="1"
              max="1000000"
              step="0.01"
              className={inputClass}
              placeholder="45.00"
            />
            {state.fieldErrors?.price?.[0] && (
              <span className="mt-2 block font-normal text-red-700">
                {state.fieldErrors.price[0]}
              </span>
            )}
          </label>
        </div>
        <FormFeedback state={state} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add service"}
        </button>
      </form>
    </div>
  );
}
