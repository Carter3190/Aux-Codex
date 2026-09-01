import "server-only";

import { getSupabaseConfig } from "./config";

const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();

export function isSupabaseAdminConfigured() {
  return Boolean(supabaseSecretKey?.startsWith("sb_secret_"));
}

export function getSupabaseAdminConfig() {
  const { url } = getSupabaseConfig();

  if (!isSupabaseAdminConfigured() || !supabaseSecretKey) {
    throw new Error(
      "Supabase server access is not configured. Add SUPABASE_SECRET_KEY to .env.local.",
    );
  }

  return { url, secretKey: supabaseSecretKey };
}
