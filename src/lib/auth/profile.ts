import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type UserRole = "customer" | "provider" | "admin";
export type ProviderStatus =
  | "not_applicable"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export type CurrentProfile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  providerStatus: ProviderStatus;
  createdAt: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  role: UserRole;
  provider_status: ProviderStatus;
  created_at: string;
};

export const getCurrentProfile = cache(async (): Promise<CurrentProfile> => {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims?.sub) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, provider_status, created_at")
    .eq("id", claims.sub)
    .single();

  if (error || !data) {
    redirect("/setup?reason=profile");
  }

  const profile = data as ProfileRow;

  return {
    id: profile.id,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile.full_name,
    role: profile.role,
    providerStatus: profile.provider_status,
    createdAt: profile.created_at,
  };
});

export function getRoleDashboardPath(role: UserRole) {
  return `/dashboard/${role}`;
}

export async function requireRole(role: UserRole) {
  const profile = await getCurrentProfile();

  if (profile.role !== role) {
    redirect(getRoleDashboardPath(profile.role));
  }

  return profile;
}
