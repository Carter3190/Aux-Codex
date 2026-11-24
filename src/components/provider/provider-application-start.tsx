"use client";

import Link from "next/link";
import { useActionState } from "react";
import { startProviderApplication, type ProviderEnrollmentState } from "@/lib/auth/provider-enrollment-actions";
import styles from "@/components/site-design.module.css";

const initialState: ProviderEnrollmentState = {};

export function ProviderApplicationStart() {
  const [state, action, pending] = useActionState(startProviderApplication, initialState);
  return <form action={action} className={styles.stack}>
    {state.message && <p role="alert" className={styles.notice}>{state.message}</p>}
    <div className={styles.row}>
      <button className={styles.primaryButton} disabled={pending}>{pending ? "Starting application…" : "Start application"}</button>
      <Link className={styles.secondaryButton} href="/dashboard/customer">Back to your account</Link>
    </div>
  </form>;
}
