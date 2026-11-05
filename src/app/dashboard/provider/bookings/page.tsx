import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProviderBookingSummary, ProviderEmptyState } from "@/components/dashboard/provider-bookings";
import { requireRole } from "@/lib/auth/profile";
import { getProviderBookings } from "@/lib/marketplace/data";
import { customerCalendarDay } from "@/lib/marketplace/customer-dashboard";
import { providerBookingGroups } from "@/lib/marketplace/provider-dashboard";
import styles from "@/components/dashboard/provider-dashboard.module.css";

export const metadata: Metadata = { title: "Your bookings" };
const filters = ["all", "requests", "upcoming", "history"] as const;
type Filter = typeof filters[number];

export default async function ProviderBookingsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const [{ filter: requested }, profile, bookings] = await Promise.all([searchParams, requireRole("provider"), getProviderBookings()]);
  const filter: Filter = filters.includes(requested as Filter) ? requested as Filter : "all";
  const groups = providerBookingGroups(bookings, customerCalendarDay());
  const tabs: Array<[Filter, string, number]> = [["all", "All bookings", groups.all.length], ["requests", "Requests", groups.requests.length], ["upcoming", "Upcoming", groups.upcoming.length], ["history", "History", groups.history.length]];
  return <DashboardShell profile={profile} title="Your bookings." description="Open a booking to review the request, agreed price, and next steps.">
    <div className={styles.page}>
      <nav className={styles.tabs} aria-label="Booking filters">{tabs.map(([key, label, count]) => <Link key={key} href={key === "all" ? "/dashboard/provider/bookings" : `/dashboard/provider/bookings?filter=${key}`} className={styles.tab} aria-current={filter === key ? "page" : undefined}>{label}<span>({count})</span></Link>)}</nav>
      {filter === "all" && groups.pastOpen.length > 0 && <p className={styles.historyIntro}>Bookings stay open until their status is updated, even when the requested visit date has passed.</p>}
      {groups[filter].length > 0 ? <div className={styles.bookingList}>{groups[filter].map((booking) => <ProviderBookingSummary key={booking.id} booking={booking} />)}</div> : <ProviderEmptyState title={filter === "requests" ? "No new requests" : filter === "upcoming" ? "No upcoming visits" : filter === "history" ? "No past bookings yet" : "No bookings yet"}>{filter === "requests" ? "New customer requests will appear here when they are sent." : filter === "upcoming" ? "Your accepted, paid visits will appear here. Other open bookings remain available in All bookings." : filter === "history" ? "Completed, declined, and cancelled bookings appear here." : "Customer booking requests and their updates will appear here."}</ProviderEmptyState>}
    </div>
  </DashboardShell>;
}
