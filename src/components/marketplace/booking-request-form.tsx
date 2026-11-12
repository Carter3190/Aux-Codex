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
import { BookingRequestConfirmation } from "./booking-request-confirmation";
import styles from "./booking-request.module.css";

const inputClass = styles.input;

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

  if (state.status === "success") return <BookingRequestConfirmation focusOnMount />;

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="providerId" value={providerId} />
      <label className={styles.field}>
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

      <div className={styles.timing}>
        <label className={styles.field}>
          Requested date
          <DateField
            name="requestedDate"
            min={minimumDate}
            required
            className={inputClass}
          />
          <FieldError message={state.fieldErrors?.requestedDate?.[0]} />
        </label>
        <label className={styles.field}>
          Preferred start time
          <TimeField
            name="requestedTime"
            required
            className={inputClass}
          />
          <FieldError message={state.fieldErrors?.requestedTime?.[0]} />
        </label>
      </div>

      <label className={styles.field}>
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
        <span className={styles.hint}>
          This stays private and is shown only to you, the provider, and Auxilium admins.
        </span>
        <FieldError message={state.fieldErrors?.serviceLocation?.[0]} />
      </label>

      <label className={styles.field}>
        What do you need help with? <span className={styles.optional}>(optional)</span>
        <textarea
          name="notes"
          rows={5}
          maxLength={2000}
          className={inputClass}
          placeholder="Share the scope, timing, or any details the provider should know."
        />
        <FieldError message={state.fieldErrors?.notes?.[0]} />
      </label>

      <section className={styles.acknowledgement} aria-label="Before sending your request">
        <h3>Before sending your request</h3>
        <p className={styles.provider}>{providerName}</p>
        <label className={styles.check}>
        <input
          type="checkbox"
          name="providerResponsibilityAcknowledged"
          value="accepted"
          required
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
      </section>

      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={styles.error}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || services.length === 0}
        className={styles.primary}
      >
        {pending ? "Sending request…" : "Agree and send booking request"}
      </button>
    </form>
  );
}
