import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/profile";
import { providerBookingReturnPath } from "@/lib/auth/return-path";

/** Authenticated bridge keeps existing login and legal-review return rules. */
export default async function ResumeProviderBooking({ params }: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  if (!providerBookingReturnPath(providerId)) notFound();
  await requireRole("customer");
  redirect(`/providers/${providerId.toLowerCase()}#request-booking`);
}
