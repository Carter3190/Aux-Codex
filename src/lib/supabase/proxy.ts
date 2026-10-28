import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "./config";

export async function updateSession(request: NextRequest) {
  const nextResponse = () => {
    // Build this after any auth-cookie refresh so the Server Component receives
    // both the refreshed session and the trusted original return path.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(
      "x-auxilium-request-path",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.next({ request: { headers: requestHeaders } });
  };

  if (!isSupabaseConfigured()) {
    return nextResponse();
  }

  let supabaseResponse = nextResponse();
  const { url, publishableKey } = getSupabaseConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = nextResponse();

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([name, value]) => {
          supabaseResponse.headers.set(name, value);
        });
      },
    },
  });

  // This verifies the JWT and refreshes expired auth cookies when necessary.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
