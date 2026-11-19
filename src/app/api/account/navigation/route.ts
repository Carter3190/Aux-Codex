import { getOptionalCurrentProfile } from "@/lib/auth/profile";
import { accountNavigationHeaders, accountNavigationState } from "@/lib/auth/account-navigation";

export const dynamic = "force-dynamic";

function denied() {
  return new Response(null, { status: 403, headers: { "Cache-Control": "private, no-store", Vary: "Origin, Cookie" } });
}

export async function GET(request: Request) {
  const headers = accountNavigationHeaders(request.headers.get("origin"));
  if (!headers) return denied();
  const profile = await getOptionalCurrentProfile();
  return Response.json(accountNavigationState(profile), { headers });
}

export function OPTIONS(request: Request) {
  const headers = accountNavigationHeaders(request.headers.get("origin"));
  return headers ? new Response(null, { status: 204, headers }) : denied();
}
