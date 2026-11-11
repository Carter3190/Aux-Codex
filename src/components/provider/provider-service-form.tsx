"use client";

import Link from "next/link";
import { useActionState } from "react";
import { NumberField, SelectField } from "@/components/ui/fields";
import { addProviderService, removeProviderService } from "@/lib/providers/actions";
import { formatPrice, labelFromSnakeCase } from "@/lib/providers/presentation";
import { initialProviderActionState, type ProviderService } from "@/lib/providers/types";
import { FormFeedback } from "./form-feedback";
import styles from "./provider-forms.module.css";

export function ProviderServiceForm({ services }: { services: ProviderService[] }) {
  const [state, action, pending] = useActionState(addProviderService, initialProviderActionState);

  return (
    <div className={styles.stack}>
      {services.length > 0 && <section className={styles.stack} aria-label="Your saved services">
        {services.map((service) => <article key={service.id} className={styles.service}>
          <div><h3>{service.name}</h3><p>{service.description}</p><p>{formatPrice(service.pricingType, service.priceCents)}</p></div>
          <span className={styles.badge}>{labelFromSnakeCase(service.pricingType)}</span>
          <form action={removeProviderService}>
            <input type="hidden" name="serviceId" value={service.id} />
            <button type="submit" className={styles.remove}>Remove</button>
          </form>
        </article>)}
      </section>}
      <form action={action} className={styles.panel}>
        <h2>Add a service</h2>
        <div className={styles.columns}>
          <label className={styles.field}>Service name
            <input name="name" required maxLength={80} className={styles.input} placeholder="Name the service you offer" />
            {state.fieldErrors?.name?.[0] && <span className={styles.error}>{state.fieldErrors.name[0]}</span>}
          </label>
          <label className={styles.field}>Pricing method
            <SelectField name="pricingType" defaultValue="hourly" aria-label="Pricing method">
              <option value="hourly">Hourly</option><option value="fixed">Fixed price</option><option value="starting_at">Starting at</option><option value="quote">Contact for quote</option>
            </SelectField>
          </label>
        </div>
        <div className={styles.columns}>
          <label className={styles.field}>Short description
            <input name="description" maxLength={500} className={styles.input} placeholder="What is included in this service?" />
          </label>
          <label className={styles.field}>Price in dollars
            <NumberField name="price" min="1" max="1000000" step="0.01" placeholder="45.00" aria-label="Price in dollars" />
            <span className={styles.hint}>Leave blank when customers need a quote.</span>
            {state.fieldErrors?.price?.[0] && <span className={styles.error}>{state.fieldErrors.price[0]}</span>}
          </label>
        </div>
        <label className={styles.check}>
          <input type="checkbox" name="servicePolicyConfirmation" value="accepted" required />
          <span>I confirm this is not healthcare, chiropractic care, medical or clinical diagnosis or treatment, patient care, or emergency-response work, and that I am authorized, licensed, and insured as required to perform this service.</span>
        </label>
        {state.fieldErrors?.servicePolicyConfirmation?.[0] && <p className={styles.error}>Confirm the service policy before adding this service.</p>}
        <FormFeedback state={state} />
        <div className={styles.actions}>
          <button type="submit" disabled={pending} className={styles.primary}>{pending ? "Adding…" : "Add service"}</button>
          <Link href="/dashboard/provider/onboarding?section=photos" className={styles.secondary}>Continue to photos</Link>
        </div>
      </form>
    </div>
  );
}
