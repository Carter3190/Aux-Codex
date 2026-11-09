import Link from "next/link";
import styles from "./layout.module.css";

export default function ProvidersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.shell}>
      {children}
      <footer className={styles.footer} data-marketplace-footer>
        <div className={styles.footerInner}>
          <nav className={styles.footerLinks} aria-label="Support and legal">
            <Link href="/support">Support</Link>
            <Link href="/terms">Terms of service</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/cancellation-refunds">Cancellation & refunds</Link>
          </nav>
          <p>© 2026 Auxilium LLC. <span>Payments processed by Stripe.</span></p>
        </div>
      </footer>
    </div>
  );
}
