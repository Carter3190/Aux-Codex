import type { Metadata } from "next";
import { ProviderOverview } from "@/components/dashboard/provider-overview";
import { getProviderBookings, getPublicProviderServiceChecks } from "@/lib/marketplace/data";
import { getProviderWorkspace } from "@/lib/providers/data";
import { getProviderPaymentSetup } from "@/lib/payments/data";

export const metadata: Metadata = { title: "Provider dashboard" };

export default async function ProviderDashboardPage() {
  const [workspace, bookings] = await Promise.all([getProviderWorkspace(), getProviderBookings()]);
  const [paymentSetup, serviceChecks] = await Promise.all([
    getProviderPaymentSetup(workspace.profile.id),
    workspace.profile.providerStatus === "approved"
      ? getPublicProviderServiceChecks(workspace.profile.id)
      : [],
  ]);
  const reviewedServiceIds = new Set(serviceChecks.filter((check) => check.eligible).map((check) => check.serviceId));
  const serviceReviewNeeded = workspace.services.some((service) => service.isActive && !reviewedServiceIds.has(service.id));
  return <ProviderOverview
    workspace={workspace}
    bookings={bookings}
    paymentSetup={paymentSetup}
    serviceReviewNeeded={serviceReviewNeeded}
  />;
}
