import Link from "next/link";
import styles from "./site-navigation.module.css";

const links = [
  ["Support", "/support"],
  ["Terms of service", "/terms"],
  ["Privacy policy", "/privacy"],
  ["Cancellation & refunds", "/cancellation-refunds"],
  ["Provider agreement", "/provider-agreement"],
  ["Provider standards", "/provider-standards"],
];

export function SiteFooter() {
  return <footer data-site-footer className={styles.footer}>
    <div className={styles.footerInner}>
      <nav className={styles.footerLinks} aria-label="Support and legal">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      <p>© 2026 Auxilium LLC. <span>Payments processed by Stripe.</span></p>
    </div>
  </footer>;
}
