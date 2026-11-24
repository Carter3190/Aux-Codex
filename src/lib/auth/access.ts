import type { CurrentProfile } from "./profile";

type AccountAccess = Pick<CurrentProfile, "role" | "primaryRole" | "customerAccess">;

export function hasCustomerAccess(profile: AccountAccess | null) {
  return profile?.role === "customer" || profile?.customerAccess === true;
}

export function hasProviderAccess(profile: AccountAccess | null) {
  return (profile?.primaryRole ?? profile?.role) === "provider";
}
