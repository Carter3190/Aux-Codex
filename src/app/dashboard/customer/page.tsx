import type { Metadata } from "next";
import { CustomerOverview } from "@/components/dashboard/customer-overview";
import { getCustomerBookings } from "@/lib/marketplace/data";

export const metadata: Metadata = { title: "Customer dashboard" };

export default async function CustomerDashboardPage({ searchParams }: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const query = await searchParams;
  const { customer, bookings } = await getCustomerBookings();
  return <CustomerOverview profile={customer} bookings={bookings} payment={query.payment} />;
}
