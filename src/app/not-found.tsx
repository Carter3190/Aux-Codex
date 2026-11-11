import Link from "next/link";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import styles from "@/components/recovery/recovery-pages.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.narrow}>
        <section className={styles.panel}>
          <span className={styles.icon}><CustomerIcon name="book" /></span>
          <p className={styles.eyebrow}>Page not found</p>
          <h1>This page isn’t available</h1>
          <p className={styles.description}>The address may have changed, or the page may no longer exist.</p>
          <div className={styles.actions}><Link href="/" className={styles.primary}>Return home</Link></div>
        </section>
      </div>
    </main>
  );
}
