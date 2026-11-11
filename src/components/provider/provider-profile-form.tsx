"use client";

import Link from "next/link";
import { useActionState } from "react";
import { NumberField } from "@/components/ui/fields";
import { saveProviderDetails } from "@/lib/providers/actions";
import { initialProviderActionState, type ProviderDetails } from "@/lib/providers/types";
import { FormFeedback } from "./form-feedback";
import styles from "./provider-forms.module.css";

export function ProviderProfileForm({ details }: { details: ProviderDetails }) {
  const [state, action, pending] = useActionState(saveProviderDetails, initialProviderActionState);
  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0]
    ? <span className={styles.error}>{state.fieldErrors[name]![0]}</span> : null;

  return (
    <form action={action} className={styles.form}>
      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="provider-business-details">
          <h2 id="provider-business-details">Business details</h2>
          <label className={styles.field}>
            Business name <span>(optional)</span>
            <input name="businessName" defaultValue={details.businessName} maxLength={100} className={styles.input} placeholder="Your business name" />
            {fieldError("businessName")}
          </label>
          <div className={styles.field}>
            <NumberField label="Years of experience" name="yearsExperience" min="0" max="80" defaultValue={details.yearsExperience ?? ""} range unit="years" aria-label="Years of experience" placeholder="Years" />
            {fieldError("yearsExperience")}
          </div>
          <label className={styles.field}>
            Primary service area
            <input name="serviceArea" required maxLength={160} defaultValue={details.serviceArea} className={styles.input} placeholder="City or area you serve" />
            {fieldError("serviceArea")}
          </label>
          <div className={styles.field}>
            <NumberField label="Travel radius (miles)" name="travelRadiusMiles" min="0" max="250" defaultValue={details.travelRadiusMiles ?? ""} range unit="miles" aria-label="Travel radius in miles" placeholder="Miles" />
            {fieldError("travelRadiusMiles")}
          </div>
        </section>
        <section className={styles.panel} aria-labelledby="provider-about-work">
          <h2 id="provider-about-work">About your work</h2>
          <label className={styles.field}>
            Professional headline
            <input name="headline" required minLength={10} maxLength={120} defaultValue={details.headline} className={styles.input} placeholder="A short description of your work and approach" />
            {fieldError("headline")}
          </label>
          <label className={styles.field}>
            Introduction
            <textarea name="bio" required minLength={80} maxLength={2000} rows={8} defaultValue={details.bio} className={styles.input} placeholder="Describe your experience, the work you offer, and how you approach each job." />
            <span className={styles.hint}>At least 80 characters. Keep sensitive personal information out of your public introduction.</span>
            {fieldError("bio")}
          </label>
        </section>
      </div>
      <FormFeedback state={state} />
      <div className={styles.actions}>
        <button type="submit" disabled={pending} className={styles.primary}>{pending ? "Saving…" : "Save introduction"}</button>
        <Link href="/dashboard/provider/onboarding?section=services" className={styles.secondary}>Continue to services</Link>
      </div>
    </form>
  );
}
