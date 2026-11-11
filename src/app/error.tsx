"use client";

import Link from "next/link";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import styles from "@/components/recovery/recovery-pages.module.css";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className={styles.page}>
      <div className={styles.narrow}>
        <section className={styles.panel}>
          <span className={styles.icon}><CustomerIcon name="help" /></span>
          <p className={styles.eyebrow}>Something went wrong</p>
          <h1>This page couldn’t load</h1>
          <p className={styles.description}>Try loading it again. If it still won’t open, return home or contact support.</p>
          <div className={styles.actions}>
            <button type="button" onClick={() => retry()} className={styles.primary}>Try again</button>
            <Link href="/" className={styles.secondary}>Return home</Link>
          </div>
          <p className={styles.support}><Link href="/support">Contact support</Link></p>
        </section>
      </div>
    </main>
  );
}
