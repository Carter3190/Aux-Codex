"use client";

import Link from "next/link";
import { useActionState } from "react";
import { TimeField } from "@/components/ui/fields";
import { saveProviderAvailability } from "@/lib/providers/actions";
import { weekdays } from "@/lib/providers/presentation";
import { initialProviderActionState, type ProviderAvailability } from "@/lib/providers/types";
import { FormFeedback } from "./form-feedback";
import styles from "./provider-forms.module.css";

export function ProviderAvailabilityForm({ availability }: { availability: ProviderAvailability[] }) {
  const [state, action, pending] = useActionState(saveProviderAvailability, initialProviderActionState);

  return <form action={action} className={styles.panel}>
    <div>{availability.map((day) => <div key={day.weekday} className={styles.day}>
      <label className={styles.dayToggle}>
        <input type="checkbox" name={`available_${day.weekday}`} defaultChecked={day.isAvailable} />
        {weekdays[day.weekday]}
      </label>
      <label className={styles.field}>Start
        <TimeField name={`start_${day.weekday}`} defaultValue={day.startTime ?? "09:00"} aria-label={`${weekdays[day.weekday]} start time`} />
      </label>
      <label className={styles.field}>End
        <TimeField name={`end_${day.weekday}`} defaultValue={day.endTime ?? "17:00"} aria-label={`${weekdays[day.weekday]} end time`} />
      </label>
    </div>)}</div>
    <FormFeedback state={state} />
    <div className={styles.actions}>
      <button type="submit" disabled={pending} className={styles.primary}>{pending ? "Saving…" : "Save availability"}</button>
      <Link href="/dashboard/provider/onboarding?section=review" className={styles.secondary}>Review application</Link>
    </div>
  </form>;
}
