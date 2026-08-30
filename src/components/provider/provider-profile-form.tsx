"use client";

import { useActionState } from "react";
import { saveProviderDetails } from "@/lib/providers/actions";
import {
  initialProviderActionState,
  type ProviderDetails,
} from "@/lib/providers/types";
import { FormFeedback } from "./form-feedback";

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 text-foreground outline-none transition placeholder:text-[#95a099] focus:border-brand focus:ring-4 focus:ring-brand/10";

export function ProviderProfileForm({ details }: { details: ProviderDetails }) {
  const [state, action, pending] = useActionState(
    saveProviderDetails,
    initialProviderActionState,
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm font-semibold text-foreground">
          Business name <span className="font-normal text-muted">(optional)</span>
          <input
            name="businessName"
            defaultValue={details.businessName}
            maxLength={100}
            className={inputClass}
            placeholder="Dylan’s Home Services"
          />
          {state.fieldErrors?.businessName?.[0] && (
            <span className="mt-2 block font-normal text-red-700">
              {state.fieldErrors.businessName[0]}
            </span>
          )}
        </label>
        <label className="text-sm font-semibold text-foreground">
          Years of experience
          <input
            name="yearsExperience"
            type="number"
            min="0"
            max="80"
            defaultValue={details.yearsExperience ?? ""}
            className={inputClass}
            placeholder="5"
          />
          {state.fieldErrors?.yearsExperience?.[0] && (
            <span className="mt-2 block font-normal text-red-700">
              {state.fieldErrors.yearsExperience[0]}
            </span>
          )}
        </label>
      </div>

      <label className="block text-sm font-semibold text-foreground">
        Professional headline
        <input
          name="headline"
          required
          minLength={10}
          maxLength={120}
          defaultValue={details.headline}
          className={inputClass}
          placeholder="Dependable home repairs and seasonal maintenance"
        />
        {state.fieldErrors?.headline?.[0] && (
          <span className="mt-2 block font-normal text-red-700">
            {state.fieldErrors.headline[0]}
          </span>
        )}
      </label>

      <label className="block text-sm font-semibold text-foreground">
        About your work
        <textarea
          name="bio"
          required
          minLength={80}
          maxLength={2000}
          rows={7}
          defaultValue={details.bio}
          className={inputClass}
          placeholder="Describe your experience, how you work, and what customers can expect."
        />
        <span className="mt-2 block font-normal text-muted">
          Minimum 80 characters. Do not include sensitive personal information.
        </span>
        {state.fieldErrors?.bio?.[0] && (
          <span className="mt-2 block font-normal text-red-700">
            {state.fieldErrors.bio[0]}
          </span>
        )}
      </label>

      <div className="grid gap-5 md:grid-cols-[1fr_220px]">
        <label className="text-sm font-semibold text-foreground">
          Primary service area
          <input
            name="serviceArea"
            required
            maxLength={160}
            defaultValue={details.serviceArea}
            className={inputClass}
            placeholder="Detroit and nearby communities"
          />
          {state.fieldErrors?.serviceArea?.[0] && (
            <span className="mt-2 block font-normal text-red-700">
              {state.fieldErrors.serviceArea[0]}
            </span>
          )}
        </label>
        <label className="text-sm font-semibold text-foreground">
          Travel radius (miles)
          <input
            name="travelRadiusMiles"
            type="number"
            min="0"
            max="250"
            defaultValue={details.travelRadiusMiles ?? ""}
            className={inputClass}
            placeholder="20"
          />
          {state.fieldErrors?.travelRadiusMiles?.[0] && (
            <span className="mt-2 block font-normal text-red-700">
              {state.fieldErrors.travelRadiusMiles[0]}
            </span>
          )}
        </label>
      </div>

      <FormFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save introduction"}
      </button>
    </form>
  );
}
