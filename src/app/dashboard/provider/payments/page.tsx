import type { Metadata } from "next";
import { ProviderPayments } from "@/components/payments/provider-payments";
import { requireRole } from "@/lib/auth/profile";
import { getProviderBookings } from "@/lib/marketplace/data";
import { getProviderPaymentSetup } from "@/lib/payments/data";
import { getProviderEarnings } from "@/lib/payments/provider-earnings";

export const metadata: Metadata = { title: "Your provider payments" };

export default async function ProviderPaymentsPage({ searchParams }: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [profile, allBookings, query] = await Promise.all([requireRole("provider"), getProviderBookings(), searchParams]);
  const payments = allBookings.filter((booking) => booking.payment !== null);
  const pageCount = Math.max(1, Math.ceil(payments.length / 20));
  const requestedPage = Number(query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  const bookings = payments.slice((page - 1) * 20, page * 20);
  const [setup, earnings] = await Promise.all([getProviderPaymentSetup(profile.id), getProviderEarnings(bookings)]);
  return <ProviderPayments profile={profile} bookings={bookings} setup={setup} earnings={earnings} pagination={{ page, pageCount, totalPayments: payments.length }} />;
}
