"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

export function SiteHeader({
  accountHref = "/login",
  accountLabel = "Sign In",
  secondaryAccountHref,
  secondaryAccountLabel,
  greeting,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#")) return false;
    return pathname.startsWith(href.split("?")[0]);
  }

  const accountLinks: ReadonlyArray<readonly [string, string]> = [
    [accountLabel, accountHref],
    ...(secondaryAccountHref && secondaryAccountLabel
      ? ([[secondaryAccountLabel, secondaryAccountHref]] as const)
      : []),
  ];
  const allLinks = [...navigation, ...accountLinks];

  return (
    <header className="relative z-40 border-b border-border bg-white shadow-[0_12px_26px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex min-h-24 max-w-[1600px] items-center justify-between gap-8 px-6 sm:px-8 lg:px-12 xl:px-16">
        <Link
          href="/"
          className="text-2xl font-medium tracking-[-0.025em] text-foreground sm:text-[1.7rem]"
        >
          Auxilium
        </Link>

        <nav
          className="hidden items-center gap-7 text-base lg:flex xl:gap-10 xl:text-lg"
          aria-label="Main navigation"
        >
          {greeting && (
            <span className="hidden text-sm text-muted 2xl:inline">{greeting}</span>
          )}
          {allLinks.map(([label, href]) => (
            <Link
              key={`${label}-${href}`}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`border-b py-1 transition-colors hover:border-foreground ${
                isActive(href)
                  ? "border-foreground text-foreground"
                  : "border-transparent text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center lg:hidden"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-site-navigation"
          onClick={() => setMenuOpen(true)}
        >
          <span className="grid w-9 gap-2" aria-hidden="true">
            <span className="h-px w-full bg-foreground" />
            <span className="h-px w-full bg-foreground" />
          </span>
        </button>
      </div>

      {menuOpen && (
        <div
          id="mobile-site-navigation"
          className="fixed inset-0 z-50 overflow-y-auto bg-[#f4f4f4] px-6 py-7 sm:px-10"
        >
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-2xl font-medium tracking-[-0.025em] text-foreground"
              onClick={() => setMenuOpen(false)}
            >
              Auxilium
            </Link>
            <button
              type="button"
              className="relative h-16 w-16 border-2 border-foreground"
              aria-label="Close navigation menu"
              onClick={() => setMenuOpen(false)}
            >
              <span
                className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-foreground"
                aria-hidden="true"
              />
              <span
                className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-foreground"
                aria-hidden="true"
              />
            </button>
          </div>

          <nav
            className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-xl flex-col items-center justify-center gap-5 py-12 text-center text-4xl leading-tight sm:text-5xl"
            aria-label="Mobile navigation"
          >
            {allLinks.map(([label, href]) => (
              <Link
                key={`${label}-${href}-mobile`}
                href={href}
                className="px-4 py-1 text-foreground transition-opacity hover:opacity-55"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
