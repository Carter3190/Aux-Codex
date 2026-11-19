import { getOptionalCurrentProfile } from "@/lib/auth/profile";
import { SiteNavigation, type SiteNavigationProps } from "./site-navigation";

type SiteHeaderProps = Omit<SiteNavigationProps, "showOfferServices">;

export async function SiteHeader(props: SiteHeaderProps) {
  const profile = await getOptionalCurrentProfile();

  return <SiteNavigation {...props} showOfferServices={profile?.role !== "provider"} />;
}
