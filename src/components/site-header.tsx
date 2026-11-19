import { getOptionalCurrentProfile } from "@/lib/auth/profile";
import { accountNavigationState } from "@/lib/auth/account-navigation";
import { SiteNavigation, type SiteNavigationProps } from "./site-navigation";

type SiteHeaderProps = Omit<SiteNavigationProps, "showOfferServices" | "account">;

export async function SiteHeader(props: SiteHeaderProps) {
  const profile = await getOptionalCurrentProfile();

  return <SiteNavigation {...props} {...accountNavigationState(profile)} />;
}
