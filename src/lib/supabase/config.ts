const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export function isSupabaseConfigured() {
  return Boolean(
    supabaseUrl?.startsWith("https://") &&
      supabaseUrl.includes(".supabase.co") &&
      supabasePublishableKey?.startsWith("sb_publishable_"),
  );
}

export function getSupabaseConfig() {
  if (!isSupabaseConfigured() || !supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase is not configured. Add the project URL and publishable key to .env.local.",
    );
  }

  return {
    url: supabaseUrl,
    publishableKey: supabasePublishableKey,
  };
}
