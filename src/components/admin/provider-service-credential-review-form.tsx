"use client";

import { useActionState, useState } from "react";
import { FormFeedback } from "@/components/provider/form-feedback";
import { reviewProviderServiceCredentials } from "@/lib/providers/actions";
import {
  initialProviderActionState,
  type AdminProviderCredential,
  type ProviderServiceCredentialReview,
} from "@/lib/providers/types";

type CredentialOption = Pick<AdminProviderCredential,
  "id" | "credentialType" | "title" | "issuer" | "expiresOn" | "documentUrl"
>;
type Requirement = "required" | "not_required" | "";

function RequirementChoice({
  name,
  title,
  value,
  onChange,
  error,
}: {
  name: "licenseRequirement" | "insuranceRequirement";
  title: string;
  value: Requirement;
  onChange: (value: Requirement) => void;
  error?: string;
}) {
  const labels = name === "licenseRequirement"
    ? { required: "License required", not_required: "No license required" }
    : { required: "Insurance required", not_required: "No insurance required" };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-foreground">{title}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {(["required", "not_required"] as const).map((option) => (
          <label key={option} className="inline-flex min-h-8 items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name={name}
              value={option}
              required
              checked={value === option}
              onChange={() => onChange(option)}
              className="h-4 w-4 accent-brand"
            />
            {labels[option]}
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </fieldset>
  );
}

function CredentialChoices({
  name,
  title,
  options,
  selected,
  onChange,
  empty,
  error,
}: {
  name: "licenseCredentialIds" | "insuranceCredentialIds";
  title: string;
  options: CredentialOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  empty: React.ReactNode;
  error?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-foreground">{title}</legend>
      {options.length ? options.map((option) => (
        <div key={option.id} className="rounded-xl border border-border bg-white p-3">
          <label className="flex items-start gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              name={name}
              value={option.id}
              checked={selected.includes(option.id)}
              onChange={(event) => onChange(event.target.checked
                ? [...selected, option.id]
                : selected.filter((id) => id !== option.id))}
              className="mt-1 h-4 w-4 shrink-0 accent-brand"
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              <span className="font-semibold">{option.title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">
                {option.issuer} · {option.expiresOn ? `Expires ${option.expiresOn}` : "Expiration not recorded"}
              </span>
              {option.credentialType === "license" && !option.expiresOn && (
                <span className="mt-1 block text-xs leading-5 text-muted">
                  Confirm with the issuing authority that this license is non-expiring and active.
                </span>
              )}
            </span>
          </label>
          {option.documentUrl && (
            <a href={option.documentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex pl-6 text-xs font-semibold text-brand underline underline-offset-4">
              View private document
            </a>
          )}
        </div>
      )) : <p className="text-xs leading-5 text-muted">{empty}</p>}
      {error && <p className="text-xs leading-5 text-red-700">{error}</p>}
    </fieldset>
  );
}

export function ProviderServiceCredentialReviewForm({
  serviceId,
  serviceUpdatedAt,
  profileUpdatedAt,
  credentials,
  currentReview,
  credentialsSectionId,
}: {
  serviceId: string;
  serviceUpdatedAt: string;
  profileUpdatedAt: string;
  credentials: CredentialOption[];
  currentReview: ProviderServiceCredentialReview | null;
  credentialsSectionId: string;
}) {
  const [state, action, pending] = useActionState(
    reviewProviderServiceCredentials,
    initialProviderActionState,
  );
  const [licenseRequirement, setLicenseRequirement] = useState<Requirement>(
    currentReview ? currentReview.licenseRequired ? "required" : "not_required" : "",
  );
  const [insuranceRequirement, setInsuranceRequirement] = useState<Requirement>(
    currentReview ? currentReview.insuranceRequired ? "required" : "not_required" : "",
  );
  const [licenseIds, setLicenseIds] = useState(currentReview?.licenseCredentialIds ?? []);
  const [insuranceIds, setInsuranceIds] = useState(currentReview?.insuranceCredentialIds ?? []);
  const licenses = credentials.filter((credential) => credential.credentialType === "license");
  const insurance = credentials.filter((credential) => credential.credentialType === "insurance");
  const hasInsurance = insurance.some((credential) => insuranceIds.includes(credential.id));
  const hasLicense = licenses.some((credential) => licenseIds.includes(credential.id));
  const canSave = licenseRequirement && insuranceRequirement &&
    (licenseRequirement === "not_required" || hasLicense) &&
    (insuranceRequirement === "not_required" || hasInsurance);
  const privateCredentials = (
    <a href={`#${credentialsSectionId}`} className="font-semibold text-brand underline underline-offset-4">
      Private credentials
    </a>
  );

  return (
    <form action={action} className="mt-4 space-y-4 border-t border-border pt-4">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="serviceUpdatedAt" value={serviceUpdatedAt} />
      <input type="hidden" name="profileUpdatedAt" value={profileUpdatedAt} />
      <p className="text-sm leading-6 text-muted">
        Check the licensing rules and insurance requirements for this work and service area. If insurance is required, confirm the insured party, covered work, and service area with the insurer or broker. Select the individually approved documents that apply.
      </p>
      <RequirementChoice
        name="licenseRequirement"
        title="License requirement for this service and area"
        value={licenseRequirement}
        onChange={setLicenseRequirement}
        error={state.fieldErrors?.licenseRequirement?.[0]}
      />
      {licenseRequirement === "required" && <CredentialChoices
        name="licenseCredentialIds"
        title="Applicable licenses"
        options={licenses}
        selected={licenseIds}
        onChange={setLicenseIds}
        empty={<>Confirm an applicable license in {privateCredentials} before selecting it.</>}
        error={state.fieldErrors?.licenseCredentialIds?.[0]}
      />}
      <RequirementChoice
        name="insuranceRequirement"
        title="Insurance requirement for this service and area"
        value={insuranceRequirement}
        onChange={setInsuranceRequirement}
        error={state.fieldErrors?.insuranceRequirement?.[0]}
      />
      {insuranceRequirement === "required" && <CredentialChoices
        name="insuranceCredentialIds"
        title="Applicable insurance documents"
        options={insurance}
        selected={insuranceIds}
        onChange={setInsuranceIds}
        empty={<>Approve current insurance in {privateCredentials} before selecting it. Use “Confirm approval” to record an individual review on an earlier approval.</>}
        error={state.fieldErrors?.insuranceCredentialIds?.[0]}
      />}
      <label className="flex items-start gap-2.5 rounded-xl border border-border bg-[#f7f7f7] p-3 text-sm leading-6 text-foreground">
        <input type="checkbox" name="scopeConfirmed" value="confirmed" required className="mt-1 h-4 w-4 shrink-0 accent-brand" />
        <span>I checked both requirements for this work and area. If a license is required, I confirmed its status with the issuing authority. If insurance is required, I confirmed the insured party and applicable coverage with the insurer or broker.</span>
      </label>
      {state.fieldErrors?.scopeConfirmed?.[0] && <p className="text-xs text-red-700">{state.fieldErrors.scopeConfirmed[0]}</p>}
      <FormFeedback state={state} />
      <button type="submit" disabled={pending || !canSave} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Saving…" : "Save service credential review"}
      </button>
    </form>
  );
}
