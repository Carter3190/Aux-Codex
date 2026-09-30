import Link from "next/link";

const exploreLinks = [
  ["Browse providers", "/providers"],
  ["Offer your services", "/signup?role=provider"],
  ["Sign in", "/login"],
];

const helpLinks = [
  ["Support", "/support"],
  ["Terms of service", "/terms"],
  ["Privacy policy", "/privacy"],
];

const providerLinks = [
  ["Cancellation & refunds", "/cancellation-refunds"],
  ["Provider agreement", "/provider-agreement"],
  ["Provider standards", "/provider-standards"],
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
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <ul className="mt-6 space-y-4 text-base">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link
              href={href}
              className="text-foreground underline decoration-1 underline-offset-[0.35em] transition-opacity hover:opacity-55"
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
    <footer className="border-t border-border bg-[#f4f4f4]">
      <div className="mx-auto max-w-[1500px] px-8 py-16 sm:px-10 lg:px-16 lg:py-20">
        <div className="text-center">
          <Link
            href="/"
            className="text-2xl font-medium tracking-[-0.02em] text-foreground"
          >
            Auxilium
          </Link>
          <p className="mx-auto mt-8 max-w-2xl text-xl leading-8 text-foreground sm:text-2xl">
            A local-service marketplace for finding trusted help, managing the
            work, and paying securely.
          </p>
        </div>

        <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-20">
          <FooterLinks title="Explore" links={exploreLinks} />
          <FooterLinks title="Help & Legal" links={helpLinks} />
          <FooterLinks title="Provider Resources" links={providerLinks} />
        </div>

        <div className="mt-16 border-t border-black/15 pt-7 text-center text-sm leading-6 text-foreground sm:text-base">
          <p>© 2026 Auxilium LLC. All rights reserved.</p>
          <p className="mt-2">Payments are processed securely by Stripe.</p>
        </div>
      </div>
    </footer>
  );
}
