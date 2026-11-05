import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import type { CurrentProfile } from "@/lib/auth/profile";
import { CustomerIcon } from "./customer-icon";
import { ProviderNavigation } from "./provider-navigation";
import styles from "./provider-shell.module.css";

type ProviderDashboardShellProps = {
  profile: CurrentProfile;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function ProviderDashboardShell({
  profile,
  eyebrow,
  title,
  description,
  actions,
  children,
}: ProviderDashboardShellProps) {
  const initials = profile.fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();
  const headingAction = actions === undefined
    ? profile.providerStatus === "approved"
      ? (
        <Link href={`/providers/${profile.id}`} className={styles.profileButton}>
          View public profile <CustomerIcon name="browse" />
        </Link>
      )
      : null
    : actions;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.wordmark}>Auxilium</Link>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">{initials || "A"}</span>
            <div className={styles.accountName}>
              <span>{profile.fullName}</span>
              <small>Provider account</small>
            </div>
            <form action={signOut}>
              <button type="submit" className={styles.signOut}>Sign out</button>
            </form>
          </div>
        </div>
        <div className={styles.navigationInner}><ProviderNavigation /></div>
      </header>

      <main className={styles.content}>
        <div className={styles.pageHeading}>
          <div className={styles.headingCopy}>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h1>{title}</h1>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {headingAction && <div className={styles.headingActions}>{headingAction}</div>}
        </div>
        <div className={styles.pageBody}>{children}</div>
      </main>

      <footer className={styles.footer} data-provider-footer>
        <div className={styles.footerInner}>
          <nav className={styles.footerLinks} aria-label="Provider support and legal">
            <Link href="/support">Support</Link>
            <Link href="/terms">Terms of service</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/cancellation-refunds">Cancellation & refunds</Link>
            <Link href="/provider-agreement">Provider agreement</Link>
            <Link href="/provider-standards">Provider standards</Link>
          </nav>
          <p>© 2026 Auxilium LLC. <span>Payments processed by Stripe.</span></p>
        </div>
      </footer>
    </div>
  );
}
