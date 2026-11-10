import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import { getSupportEmail } from "@/lib/support/config";
import styles from "@/components/site-design.module.css";

export const metadata: Metadata = {
  title: "Support center",
  description: "Get help with an Auxilium account, booking, payment, or provider application.",
  alternates: { canonical: "/support" },
};

const supportPaths = [
  { title: "My Bookings", body: "Open the booking to ask a question, review payment details, or request help with a service issue.", label: "Open my bookings", href: "/dashboard/customer/bookings", icon: "calendar" },
  { title: "Provider profile or payouts", body: "Review your application, service requirements, or Stripe setup from your provider dashboard.", label: "Open provider dashboard", href: "/dashboard/provider", icon: "book" },
  { title: "Account access", body: "Sign in with your confirmed email. If you just registered, check for the confirmation message.", label: "Go to sign in", href: "/login", icon: "help" },
] as const;

export default function SupportPage() {
  const supportEmail = getSupportEmail();
  return <main className={styles.surface}>
    <SiteHeader />
    <div className={`${styles.container} ${styles.stack}`}>
      <div><p className={styles.kicker}>Auxilium support</p><h1 className={styles.title}>How can we help?</h1></div>
      <div className={styles.grid3}>{supportPaths.map((path) => <article key={path.href} className={`${styles.card} ${styles.actionCard}`}><span className={styles.iconTile}><CustomerIcon name={path.icon} /></span><h2>{path.title}</h2><p>{path.body}</p><Link href={path.href} className={styles.secondaryButton}>{path.label}</Link></article>)}</div>
      <div className={styles.grid2}>
        <section className={`${styles.card} ${styles.stack}`}><h2>Contact Auxilium</h2><p className={styles.description}>For other questions, include your account email and booking reference when contacting support.</p>{supportEmail ? <div><a href={`mailto:${supportEmail}`} className={styles.secondaryButton}>Email support</a></div> : <p className={styles.small}>General email support is being prepared for public launch. For a booking issue, use the private resolution form in your dashboard.</p>}<p className={styles.small}>Keep passwords, full card numbers, and identity documents out of email.</p></section>
        <section className={`${styles.card} ${styles.stack}`}><h2>Useful information</h2><Link className={styles.textLink} href="/cancellation-refunds">Cancellations, refunds, and disputes</Link><Link className={styles.textLink} href="/provider-standards">Provider standards</Link><Link className={styles.textLink} href="/privacy">Privacy policy</Link></section>
      </div>
      <aside className={`${styles.notice} ${styles.warm}`}><strong>Emergency or immediate danger?</strong> Call 911 or the appropriate local emergency authority first. Auxilium is not an emergency service.</aside>
    </div>
  </main>;
}
