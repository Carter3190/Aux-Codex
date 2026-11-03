import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import type { CurrentProfile } from "@/lib/auth/profile";
import { CustomerIcon } from "./customer-icon";
import { CustomerNavigation } from "./customer-navigation";
import styles from "./customer-shell.module.css";

type CustomerDashboardShellProps = {
  profile: CurrentProfile;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function CustomerDashboardShell({
  profile,
  eyebrow,
  title,
  description,
  actions,
  children,
}: CustomerDashboardShellProps) {
  const initials = profile.fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.wordmark}>
            Auxilium<span>.</span>
          </Link>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">
              {initials || "A"}
            </span>
            <div className={styles.accountName}>
              <span>{profile.fullName}</span>
              <small>Customer account</small>
            </div>
            <form action={signOut}>
              <button type="submit" className={styles.signOut}>
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className={styles.navigationInner}>
          <CustomerNavigation />
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.pageHeading}>
          <div className={styles.headingCopy}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1>{title}</h1>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          <div className={styles.headingActions}>
            {actions === undefined ? (
              <Link href="/providers" className={styles.browseButton}>
                Browse providers <CustomerIcon name="browse" />
              </Link>
            ) : (
              actions
            )}
          </div>
        </div>
        <div className={styles.pageBody}>{children}</div>
      </div>
    </main>
  );
}
