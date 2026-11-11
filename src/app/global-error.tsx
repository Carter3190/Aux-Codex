"use client";

import { CustomerIcon } from "@/components/dashboard/customer-icon";
import styles from "@/components/recovery/recovery-pages.module.css";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body className={styles.globalBody}>
        <main className={styles.page}>
          <title>Something went wrong | Auxilium</title>
          <div className={styles.narrow}>
            <p className={styles.brand}>Auxilium</p>
            <section className={styles.panel}>
              <span className={styles.icon}><CustomerIcon name="help" /></span>
              <p className={styles.eyebrow}>Let’s try again</p>
              <h1>We couldn’t open Auxilium</h1>
              <p className={styles.description}>Please try loading Auxilium again. If the problem continues, contact support.</p>
              <div className={styles.actions}><button type="button" onClick={() => retry()} className={styles.primary}>Try again</button></div>
              <p className={styles.support}><a href="/support">Contact support</a></p>
            </section>
          </div>
        </main>
      </body>
    </html>
  );
}
