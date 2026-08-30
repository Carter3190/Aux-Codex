import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import type { CurrentProfile } from "@/lib/auth/profile";

type DashboardShellProps = {
  profile: CurrentProfile;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
};

export function DashboardShell({
  profile,
  eyebrow,
  title,
  children,
}: DashboardShellProps) {
  const navigation =
    profile.role === "provider"
      ? [
          ["Overview", "/dashboard/provider"],
          ["Profile setup", "/dashboard/provider/onboarding"],
        ]
      : profile.role === "admin"
        ? [["Review queue", "/dashboard/admin"]]
        : [["Dashboard", "/dashboard/customer"]];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-lg font-bold tracking-[0.18em] text-brand-dark"
            >
              AUXILIUM
            </Link>
            <nav className="hidden items-center gap-4 md:flex" aria-label="Dashboard">
              {navigation.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm font-semibold text-muted transition hover:text-brand-dark"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-foreground">
                {profile.fullName}
              </p>
              <p className="text-xs capitalize text-muted">{profile.role}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-[#eef6f1]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-brand-dark sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
          Signed in as {profile.email}
        </p>
        <div className="mt-10">{children}</div>
      </div>
    </main>
  );
}
