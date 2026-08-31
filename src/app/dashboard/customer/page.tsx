import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BookingCard } from "@/components/marketplace/booking-card";
import { getCustomerBookings } from "@/lib/marketplace/data";

export const metadata: Metadata = {
  title: "Customer dashboard",
};

export default async function CustomerDashboardPage() {
  const { customer: profile, bookings } = await getCustomerBookings();
  const activeCount = bookings.filter(
    (booking) => booking.status === "pending" || booking.status === "accepted",
  ).length;

  return (
    <DashboardShell
      profile={profile}
      eyebrow="Customer dashboard"
      title={`Welcome, ${profile.fullName.split(" ")[0]}.`}
    >
      <section className="rounded-3xl border border-border bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
              Marketplace
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-brand-dark">
              Ready to find the right provider?
            </h2>
            <p className="mt-2 leading-7 text-muted">
              Browse approved professionals, compare services, and send a private booking request.
            </p>
          </div>
          <Link
            href="/providers"
            className="shrink-0 rounded-full bg-brand px-6 py-3 text-center font-semibold text-white transition hover:bg-brand-dark"
          >
            Browse providers
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">Your requests</p>
            <h2 className="mt-2 text-3xl font-semibold text-brand-dark">
              {activeCount} active {activeCount === 1 ? "request" : "requests"}
            </h2>
          </div>
          <p className="text-sm text-muted">{bookings.length} total</p>
        </div>

        {bookings.length > 0 ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} perspective="customer" />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed border-border bg-white p-8 text-center">
            <h3 className="text-xl font-semibold text-brand-dark">No booking requests yet</h3>
            <p className="mt-2 text-muted">Your first request will appear here after you send it to a provider.</p>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
