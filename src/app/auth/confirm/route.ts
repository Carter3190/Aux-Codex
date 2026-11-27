import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { providerBookingReturnPath, safeDashboardReturnPath } from "@/lib/auth/return-path";

function safeNextPath(value: string | null) {
  return safeDashboardReturnPath(value) ?? "/dashboard";
}

function privateRedirect(destination: URL) {
  const response = NextResponse.redirect(destination);
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  return response;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return privateRedirect(new URL("/setup", request.url));
  }

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      const bookingReturn = (type === "email" || type === "signup")
        ? providerBookingReturnPath(data?.user?.user_metadata?.booking_provider_id)
        : null;
      if (bookingReturn) {
        // Consume the preference so future email confirmations do not reuse it.
        try { await supabase.auth.updateUser({ data: { booking_provider_id: null } }); } catch { /* The verified session remains usable. */ }
      }
      return privateRedirect(new URL(next === "/dashboard" && bookingReturn ? bookingReturn : next, request.url));
    }
  }

  return privateRedirect(new URL("/auth/error", request.url));
}
