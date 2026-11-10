"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import type { CurrentProfile } from "@/lib/auth/profile";
import styles from "./admin-shell.module.css";

export function AdminDashboardShell({
  profile,
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  profile: CurrentProfile;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const navigation = [
    ["Review queue", "/dashboard/admin"],
    ["Resolution center", "/dashboard/admin/cases"],
    ["Marketplace", "/providers"],
  ];

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.wordmark}>Auxilium</Link>
          <div className={styles.account}>
            <div className={styles.accountName}>
              <span>{profile.fullName}</span><small>Administrator</small>
            </div>
            <form action={signOut}><button type="submit" className={styles.signOut}>Sign out</button></form>
          </div>
        </div>
        <nav className={styles.navigation} aria-label="Administration">
          {navigation.map(([label, href]) => (
            <Link key={href} href={href} className={styles.navLink} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
      </header>
      <main className={styles.content}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>{eyebrow || "Administration"}</p>
            <h1>{title}</h1>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
        <div className={styles.body}>{children}</div>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <nav aria-label="Administration support and legal"><Link href="/support">Support</Link><Link href="/terms">Terms of service</Link><Link href="/privacy">Privacy policy</Link><Link href="/provider-standards">Provider standards</Link></nav>
          <p>© 2026 Auxilium LLC. <span>Payments processed by Stripe.</span></p>
        </div>
      </footer>
    </div>
  );
}
