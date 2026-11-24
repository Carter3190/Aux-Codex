"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountAvatar, type AccountAvatarData } from "./account-avatar";
import { BrandWordmark } from "./brand-wordmark";
import styles from "./site-navigation.module.css";

export type SiteNavigationProps = {
  account?: AccountAvatarData | null;
  showOfferServices?: boolean;
  accountHref?: string;
  accountLabel?: string;
  secondaryAccountHref?: string;
  secondaryAccountLabel?: string;
  greeting?: string;
};

const navigation = [
  ["Home Page", "/"],
  ["Offer Services", "/offer-services"],
] as const;

const helpNavigation = [
  ["About Us", "https://theauxillium.com/about-us"],
  ["Support", "/support"],
] as const;

export function SiteNavigation({ account = null, showOfferServices = true, accountHref = "/login", accountLabel = "Sign In", secondaryAccountHref, secondaryAccountLabel, greeting }: SiteNavigationProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountLinks: ReadonlyArray<readonly [string, string]> = account ? [] : [
    [accountLabel, accountHref],
    ...(secondaryAccountHref && secondaryAccountLabel ? [[secondaryAccountLabel, secondaryAccountHref] as const] : []),
  ];
  const primaryLinks = navigation.filter(([label]) => showOfferServices || label !== "Offer Services");
  const allLinks = [...primaryLinks, ...helpNavigation, ...accountLinks];
  function isActive(href: string) {
    if (href.includes("#") || href.includes("?")) return false;
    return href === "/" ? pathname === "/" || pathname === "/providers" || pathname.startsWith("/providers/") : pathname.startsWith(href);
  }
  return (
    <header className={styles.header} onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false); }}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand} aria-label="Auxillium" onClick={() => setMenuOpen(false)}><BrandWordmark /></Link>
        <div className={styles.headerActions}>
          <nav className={styles.desktopNav} aria-label="Main navigation">
            {!account && greeting && <span className={styles.greeting}>{greeting}</span>}
            {allLinks.map(([label, href]) => <Link key={`${label}-${href}`} href={href} className={href === "/login" ? styles.signIn : undefined} aria-current={isActive(href) ? "page" : undefined}>{label}</Link>)}
          </nav>
          <button type="button" className={styles.menuButton} aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="mobile-site-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close" : "Menu"}</button>
          {account && <AccountAvatar account={account} onClick={() => setMenuOpen(false)} />}
        </div>
      </div>
      <nav id="mobile-site-navigation" className={styles.mobileNav} aria-label="Mobile navigation" hidden={!menuOpen}>
        {allLinks.map(([label, href]) => <Link key={`${label}-${href}-mobile`} href={href} className={href === "/login" ? styles.signIn : undefined} aria-current={isActive(href) ? "page" : undefined} onClick={() => setMenuOpen(false)}>{label}</Link>)}
      </nav>
    </header>
  );
}
