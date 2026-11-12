import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerBookingSummary, CustomerEmptyState } from "@/components/dashboard/customer-bookings";
import styles from "@/components/dashboard/customer-dashboard.module.css";
import { getCustomerBookings } from "@/lib/marketplace/data";
import { customerBookingGroups } from "@/lib/marketplace/customer-dashboard";

export const metadata: Metadata = { title: "Your bookings" };

export default async function CustomerBookingsPage({ searchParams }: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const { customer: profile, bookings } = await getCustomerBookings();
  const groups = customerBookingGroups(bookings);
  const tabs = [
    { key: "all", label: "All bookings", items: groups.all },
    { key: "upcoming", label: "Upcoming", items: groups.upcoming },
    { key: "requests", label: "Requests", items: groups.requests },
    { key: "awaitingPayment", label: "Awaiting payment", items: groups.awaitingPayment },
    { key: "history", label: "History", items: groups.history },
  ];
  const active = tabs.find((tab) => tab.key === filter) ?? tabs[0];
  return (
    <DashboardShell profile={profile} eyebrow="Bookings" title="Your bookings." description="Find your visit, then open it for the details and next steps.">
      <div className={styles.page}>
        <nav className={styles.tabs} aria-label="Booking filters">
          {tabs.map((tab) => <Link className={styles.tab} aria-current={active.key === tab.key ? "page" : undefined} key={tab.key} href={tab.key === "all" ? "/dashboard/customer/bookings" : `/dashboard/customer/bookings?filter=${tab.key}`}>{tab.label}<span>({tab.items.length})</span></Link>)}
        </nav>
        {active.key === "all" && groups.pastOpen.length > 0 && <p className={styles.historyIntro}>Bookings stay open until their status is updated, even when the requested visit date has passed.</p>}
        {active.items.length ? (
          <div className={styles.bookingList}>{active.items.map((booking) => <CustomerBookingSummary booking={booking} key={booking.id} />)}</div>
        ) : (
          <CustomerEmptyState title={bookings.length ? `No ${active.key === "all" ? "bookings" : active.label.toLowerCase()} here yet` : "No booking requests yet"} browse={bookings.length === 0}>
            {bookings.length ? "Choose another booking section to see your other visits and requests." : "Your first request will appear here after you send it to a provider."}
          </CustomerEmptyState>
        )}
      </div>
    </DashboardShell>
  );
}
