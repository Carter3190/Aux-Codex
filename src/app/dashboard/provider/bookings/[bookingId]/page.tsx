import navigation from "@/components/navigation-actions.module.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import { BookingCard } from "@/components/marketplace/booking-card";
import { requireRole } from "@/lib/auth/profile";
import { getProviderBookings } from "@/lib/marketplace/data";
import { getProviderEarnings } from "@/lib/payments/provider-earnings";
import styles from "@/components/dashboard/provider-dashboard.module.css";

export const metadata: Metadata = { title: "Booking details" };

export default async function ProviderBookingDetails({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const parsed = z.uuid().safeParse(bookingId);
  if (!parsed.success) notFound();
  const [profile, bookings] = await Promise.all([requireRole("provider"), getProviderBookings()]);
  const booking = bookings.find((item) => item.id === parsed.data);
  if (!booking) notFound();
  const earnings = await getProviderEarnings([booking]);
  const canMessage = ["pending", "accepted", "completed"].includes(booking.status);
  return <DashboardShell profile={profile} title={booking.serviceName} description={booking.customerName} actions={<Link className={styles.secondaryButton} href={`/dashboard/messages/${booking.id}`}><CustomerIcon name="messages" />{canMessage ? "Message customer" : "View conversation"}</Link>}>
    <div className={styles.page}><Link className={navigation.backAction} href="/dashboard/provider/bookings"><CustomerIcon name="back" />Back to your bookings</Link><div className={styles.detailContent}><BookingCard booking={booking} perspective="provider" providerEarnings={earnings[booking.id]} /></div></div>
  </DashboardShell>;
}
