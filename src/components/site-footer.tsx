import Link from "next/link";

const marketplaceLinks = [
  ["Browse providers", "/providers"],
  ["Offer your services", "/signup?role=provider"],
  ["Sign in", "/login"],
];

const trustLinks = [
  ["Support", "/support"],
  ["Cancellation & refunds", "/cancellation-refunds"],
  ["Provider standards", "/provider-standards"],
];

const legalLinks = [
  ["Terms of service", "/terms"],
  ["Privacy policy", "/privacy"],
  ["Provider agreement", "/provider-agreement"],
];

function FooterLinks({
  title,
  links,
}: {
  title: string;
  links: string[][];
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
        {title}
      </p>
      <ul className="mt-4 space-y-3 text-sm">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link
              href={href}
              className="text-muted transition hover:text-brand-dark"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-10">
        <div>
          <Link
            href="/"
            className="text-lg font-bold tracking-[0.18em] text-brand-dark"
          >
            AUXILIUM
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            A local-service marketplace for finding trusted help, managing the
            work, and paying securely.
          </p>
        </div>
        <FooterLinks title="Marketplace" links={marketplaceLinks} />
        <FooterLinks title="Help & safety" links={trustLinks} />
        <FooterLinks title="Legal" links={legalLinks} />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <p>© 2026 Auxilium LLC. All rights reserved.</p>
          <p>Payments are processed securely by Stripe.</p>
        </div>
      </div>
    </footer>
  );
}
