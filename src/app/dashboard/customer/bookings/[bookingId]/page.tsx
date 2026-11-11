import navigation from "@/components/navigation-actions.module.css";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import styles from "@/components/dashboard/customer-dashboard.module.css";
import { BookingCard } from "@/components/marketplace/booking-card";
import { getCustomerBookings } from "@/lib/marketplace/data";

export const metadata: Metadata = { title: "Booking details" };

export default async function CustomerBookingDetails({ params }: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const parsed = z.uuid().safeParse(bookingId);
  if (!parsed.success) notFound();
  const { customer: profile, bookings } = await getCustomerBookings();
  const booking = bookings.find((item) => item.id === parsed.data);
  if (!booking) notFound();
  const canMessage = ["pending", "accepted", "completed"].includes(booking.status);
  return (
    <DashboardShell profile={profile} eyebrow="Booking details" title={booking.serviceName}
      description="Your request, provider response, payment, and next steps."
      actions={<Link className={styles.secondaryButton} href={`/dashboard/messages/${booking.id}`}><CustomerIcon name="messages" />{canMessage ? "Message provider" : "View conversation"}</Link>}>
      <div className={styles.page}>
        <Link className={navigation.backAction} href="/dashboard/customer/bookings"><CustomerIcon name="back" />Back to your bookings</Link>
        <div className={styles.detailContent}><BookingCard booking={booking} perspective="customer" /></div>
      </div>
    </DashboardShell>
  );
}
