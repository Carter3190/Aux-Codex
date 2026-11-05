import type { Metadata } from "next";
import { ProviderOverview } from "@/components/dashboard/provider-overview";
import { getProviderBookings } from "@/lib/marketplace/data";
import { getProviderWorkspace, hasCurrentInsuranceCredential } from "@/lib/providers/data";
import { getProviderPaymentSetup } from "@/lib/payments/data";

export const metadata: Metadata = { title: "Provider dashboard" };

export default async function ProviderDashboardPage() {
  const [workspace, bookings] = await Promise.all([getProviderWorkspace(), getProviderBookings()]);
  const paymentSetup = await getProviderPaymentSetup(workspace.profile.id);
  return <ProviderOverview
    workspace={workspace}
    bookings={bookings}
    paymentSetup={paymentSetup}
    insuranceReady={hasCurrentInsuranceCredential(workspace.credentials, true)}
    insurancePending={hasCurrentInsuranceCredential(workspace.credentials.filter((credential) => credential.reviewStatus === "pending"))}
  />;
}
