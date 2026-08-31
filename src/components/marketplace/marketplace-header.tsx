import Link from "next/link";
import { getRoleDashboardPath, type CurrentProfile } from "@/lib/auth/profile";

export function MarketplaceHeader({
  profile,
}: {
  profile: CurrentProfile | null;
}) {
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-5 lg:px-10">
        <div className="flex items-center gap-7">
          <Link
            href="/"
            className="text-lg font-bold tracking-[0.18em] text-brand-dark"
          >
            AUXILIUM
          </Link>
          <Link
            href="/providers"
            className="hidden text-sm font-semibold text-muted transition hover:text-brand-dark sm:block"
          >
            Browse providers
          </Link>
        </div>
        {profile ? (
          <div className="flex items-center gap-4">
            <p className="hidden text-sm text-muted md:block">
              Hi, {profile.fullName.split(" ")[0]}
            </p>
            <Link
              href={getRoleDashboardPath(profile.role)}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-background"
            >
              Sign in
            </Link>
            <Link
              href="/signup?role=customer"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
