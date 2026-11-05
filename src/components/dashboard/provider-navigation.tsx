"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CustomerIcon, type CustomerIconName } from "./customer-icon";
import styles from "./provider-shell.module.css";

const navigation: {
  label: string;
  href: string;
  icon: CustomerIconName | "profile";
  exact?: boolean;
}[] = [
  { label: "Overview", href: "/dashboard/provider", icon: "overview", exact: true },
  { label: "Bookings", href: "/dashboard/provider/bookings", icon: "calendar" },
  { label: "Messages", href: "/dashboard/messages", icon: "messages" },
  { label: "Payments", href: "/dashboard/provider/payments", icon: "payments" },
  { label: "Profile", href: "/dashboard/provider/onboarding", icon: "profile" },
];

export function ProviderNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.navigation} aria-label="Provider dashboard">
      {navigation.map(({ label, href, icon, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname?.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={styles.navLink}
          >
            {icon === "profile" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
              </svg>
            ) : <CustomerIcon name={icon} />}
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
