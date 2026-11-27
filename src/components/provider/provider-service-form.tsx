"use client";

import Link from "next/link";
import { useActionState } from "react";
import { NumberField, SelectField } from "@/components/ui/fields";
import { addProviderService, setProviderServiceActive, updateProviderService } from "@/lib/providers/actions";
import { formatPrice, labelFromSnakeCase } from "@/lib/providers/presentation";
import { initialProviderActionState, type ProviderService, type ProviderActionState } from "@/lib/providers/types";
import { FormFeedback } from "./form-feedback";
import styles from "./provider-forms.module.css";

function ServiceFields({ service, state }: { service?: ProviderService; state: ProviderActionState }) {
  return <>
    <div className={styles.columns}>
      <label className={styles.field}>Service name
        <input name="name" required minLength={2} maxLength={80} defaultValue={service?.name} className={styles.input} placeholder="Name the service you offer" />
        {state.fieldErrors?.name?.[0] && <span className={styles.error}>{state.fieldErrors.name[0]}</span>}
      </label>
      <label className={styles.field}>Pricing method
        <SelectField name="pricingType" defaultValue={service?.pricingType ?? "hourly"} aria-label="Pricing method">
          <option value="hourly">Hourly</option><option value="fixed">Fixed price</option><option value="starting_at">Starting at</option><option value="quote">Contact for quote</option>
        </SelectField>
      </label>
    </div>
    <div className={styles.columns}>
      <label className={styles.field}>Short description
        <input name="description" maxLength={500} defaultValue={service?.description} className={styles.input} placeholder="What is included in this service?" />
      </label>
      <label className={styles.field}>Price in dollars
        <NumberField name="price" min="1" max="1000000" step="0.01" defaultValue={service?.priceCents == null ? "" : (service.priceCents / 100).toFixed(2)} placeholder="45.00" aria-label="Price in dollars" />
        <span className={styles.hint}>Leave blank when customers need a quote.</span>
        {state.fieldErrors?.price?.[0] && <span className={styles.error}>{state.fieldErrors.price[0]}</span>}
      </label>
    </div>
    <label className={styles.check}>
      <input type="checkbox" name="servicePolicyConfirmation" value="accepted" required />
      <span>I confirm this is not healthcare, chiropractic care, medical or clinical diagnosis or treatment, patient care, or emergency-response work, and that I am authorized, licensed, and insured as required to perform this service.</span>
    </label>
    {state.fieldErrors?.servicePolicyConfirmation?.[0] && <p className={styles.error}>Confirm the service policy before saving this service.</p>}
  </>;
}

function SavedService({ service }: { service: ProviderService }) {
  const [state, action, pending] = useActionState(updateProviderService, initialProviderActionState);
  const [archiveState, archiveAction, archiving] = useActionState(setProviderServiceActive, initialProviderActionState);
  return <article className={styles.panel} aria-label={`${service.name} service`}>
    <div className={styles.actions}>
      <h3>{service.name}</h3>
      <span className={styles.badge}>{service.isActive ? labelFromSnakeCase(service.pricingType) : "Archived"}</span>
    </div>
    <p className={styles.description}>{service.description}</p>
    <p className={styles.description}>{formatPrice(service.pricingType, service.priceCents)}</p>
    <div className={styles.actions}>
      <form action={archiveAction}>
        <input type="hidden" name="serviceId" value={service.id} />
        <input type="hidden" name="isActive" value={String(!service.isActive)} />
        <button type="submit" disabled={archiving || pending} className={service.isActive ? styles.remove : styles.secondary}>
          {archiving ? "Saving…" : service.isActive ? "Archive service" : "Restore service"}
        </button>
      </form>
    </div>
    <FormFeedback state={archiveState} />
    <details>
      <summary className={styles.secondary}>Edit service</summary>
      <form action={action} className={styles.stack} data-unsaved-form aria-label={`Edit ${service.name}`}>
        <input type="hidden" name="serviceId" value={service.id} />
        <ServiceFields service={service} state={state} />
        <FormFeedback state={state} />
        <div className={styles.actions}><button type="submit" disabled={pending || archiving} className={styles.primary}>{pending ? "Saving…" : "Save service"}</button></div>
      </form>
    </details>
  </article>;
}

export function ProviderServiceForm({ services }: { services: ProviderService[] }) {
  const [state, action, pending] = useActionState(addProviderService, initialProviderActionState);
  return <div className={styles.stack}>
    <p className={styles.description}>Adding, editing, or restoring a service requires Auxillium review before new bookings. Archiving a service keeps its booking and payment history.</p>
    {services.length > 0 && <section className={styles.stack} aria-label="Your saved services">
      {services.map((service) => <SavedService key={service.id} service={service} />)}
    </section>}
    <form action={action} className={styles.panel} data-unsaved-form>
      <h2>Add a service</h2>
      <ServiceFields state={state} />
      <FormFeedback state={state} />
      <div className={styles.actions}>
        <button type="submit" disabled={pending} className={styles.primary}>{pending ? "Adding…" : "Add service"}</button>
        <Link href="/dashboard/provider/onboarding?section=photos" className={styles.secondary}>Continue to photos</Link>
      </div>
    </form>
  </div>;
}
