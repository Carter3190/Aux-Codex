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
          ["Messages", "/dashboard/messages"],
          ["Profile setup", "/dashboard/provider/onboarding"],
          ["Marketplace", "/providers"],
        ]
      : profile.role === "admin"
        ? [
            ["Review queue", "/dashboard/admin"],
            ["Resolution center", "/dashboard/admin/cases"],
            ["Marketplace", "/providers"],
          ]
        : [
            ["Dashboard", "/dashboard/customer"],
            ["Messages", "/dashboard/messages"],
            ["Browse providers", "/providers"],
          ];

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-border bg-white shadow-[0_10px_24px_rgba(0,0,0,0.045)]">
        <div className="mx-auto flex min-h-24 max-w-[1500px] items-center justify-between gap-6 px-6 sm:px-8 lg:px-12">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-2xl font-medium tracking-[-0.025em] text-foreground"
            >
              Auxilium
            </Link>
            <nav className="hidden items-center gap-6 md:flex" aria-label="Dashboard">
              {navigation.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="border-b border-transparent py-1 text-sm font-medium text-foreground transition hover:border-foreground"
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
                className="rounded-[0.8rem] border border-foreground px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav
          className="mx-auto flex max-w-[1500px] gap-2 overflow-x-auto border-t border-border px-6 py-3 sm:px-8 md:hidden"
          aria-label="Dashboard"
        >
          {navigation.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 rounded-[0.8rem] border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:border-foreground hover:bg-[#f4f4f4]"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-[1500px] px-6 py-12 sm:px-8 lg:px-12 lg:py-16">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-normal leading-tight tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
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
