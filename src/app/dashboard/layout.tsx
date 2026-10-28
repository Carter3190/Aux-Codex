import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getLegalAcceptanceStatus } from "@/lib/legal/data";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const legalStatus = await getLegalAcceptanceStatus(profile);

  if (!legalStatus.migrationReady || legalStatus.missing.length > 0) {
    const requestPath =
      (await headers()).get("x-auxilium-request-path") ?? "/dashboard";
    const safeRequestPath =
      requestPath.startsWith("/dashboard") && !requestPath.startsWith("//")
        ? requestPath
        : "/dashboard";
    redirect(`/legal/accept?next=${encodeURIComponent(safeRequestPath)}`);
  }

  return children;
}
