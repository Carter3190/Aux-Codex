"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./site-navigation.module.css";

type SiteHeaderProps = {
  accountHref?: string;
  accountLabel?: string;
  secondaryAccountHref?: string;
  secondaryAccountLabel?: string;
  greeting?: string;
};

const navigation = [
  ["Home", "/"],
  ["About Us", "/#about"],
  ["Find a Provider", "/providers"],
  ["Offer Services", "/signup?role=provider"],
  ["Support", "/support"],
] as const;

export function SiteHeader({ accountHref = "/login", accountLabel = "Sign in", secondaryAccountHref, secondaryAccountLabel, greeting }: SiteHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountLinks: ReadonlyArray<readonly [string, string]> = [
    [accountLabel, accountHref],
    ...(secondaryAccountHref && secondaryAccountLabel ? [[secondaryAccountLabel, secondaryAccountHref] as const] : []),
  ];
  const allLinks = [...navigation, ...accountLinks];
  function isActive(href: string) {
    if (href.includes("#") || href.includes("?")) return false;
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }
  return (
    <header className={styles.header} onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false); }}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand} onClick={() => setMenuOpen(false)}>Auxilium</Link>
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {greeting && <span className={styles.greeting}>{greeting}</span>}
          {allLinks.map(([label, href]) => <Link key={`${label}-${href}`} href={href} aria-current={isActive(href) ? "page" : undefined}>{label}</Link>)}
        </nav>
        <button type="button" className={styles.menuButton} aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="mobile-site-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close" : "Menu"}</button>
      </div>
      <nav id="mobile-site-navigation" className={styles.mobileNav} aria-label="Mobile navigation" hidden={!menuOpen}>
        {allLinks.map(([label, href]) => <Link key={`${label}-${href}-mobile`} href={href} aria-current={isActive(href) ? "page" : undefined} onClick={() => setMenuOpen(false)}>{label}</Link>)}
      </nav>
    </header>
  );
}
