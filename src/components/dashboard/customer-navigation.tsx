"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CustomerIcon, type CustomerIconName } from "./customer-icon";
import styles from "./customer-shell.module.css";

const navigation: {
  label: string;
  href: string;
  icon: CustomerIconName;
  exact?: boolean;
}[] = [
  {
    label: "Overview",
    href: "/dashboard/customer",
    icon: "overview",
    exact: true,
  },
  {
    label: "Bookings",
    href: "/dashboard/customer/bookings",
    icon: "calendar",
  },
  { label: "Messages", href: "/dashboard/messages", icon: "messages" },
  {
    label: "Payments",
    href: "/dashboard/customer/payments",
    icon: "payments",
  },
];

export function CustomerNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.navigation} aria-label="Customer dashboard">
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
            <CustomerIcon name={icon} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
