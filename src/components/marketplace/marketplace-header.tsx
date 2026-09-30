import { getRoleDashboardPath, type CurrentProfile } from "@/lib/auth/profile";
import { SiteHeader } from "@/components/site-header";

export function MarketplaceHeader({
  profile,
}: {
  profile: CurrentProfile | null;
}) {
  return profile ? (
    <SiteHeader
      accountHref={getRoleDashboardPath(profile.role)}
      accountLabel="Dashboard"
      greeting={`Hi, ${profile.fullName.split(" ")[0]}`}
    />
  ) : (
    <SiteHeader
      secondaryAccountHref="/signup?role=customer"
      secondaryAccountLabel="Create account"
    />
  );
}
