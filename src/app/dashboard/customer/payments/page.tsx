import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import { CustomerEmptyState, CustomerPaymentBadge } from "@/components/dashboard/customer-bookings";
import styles from "@/components/dashboard/customer-dashboard.module.css";
import { getCustomerBookings } from "@/lib/marketplace/data";
import { customerBookingPath, formatCustomerMoney } from "@/lib/marketplace/customer-dashboard";

export const metadata: Metadata = { title: "Your payments" };

export default async function CustomerPaymentsPage() {
  const { customer: profile, bookings } = await getCustomerBookings();
  const payments = bookings.filter((booking) => booking.payment !== null);
  return (
    <DashboardShell profile={profile} eyebrow="Payments" title="Your payments." description="Payment statuses and refunds, linked to the booking they belong to.">
      <div className={styles.page}>
        {payments.length ? (
          <div className={styles.paymentList}>{payments.map((booking) => {
            const payment = booking.payment!;
            return (
              <article className={styles.paymentRow} key={booking.id}>
                <div><h2>{booking.serviceName}</h2><p>{booking.providerName}</p>
                  {payment.paidAt && <p>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(payment.paidAt))}</p>}
                  {payment.refundedAmountCents > 0 && <p>Refunded: {formatCustomerMoney(payment.refundedAmountCents)}</p>}
                </div>
                <div><span className={styles.paymentAmount}>{formatCustomerMoney(payment.amountCents)}</span><CustomerPaymentBadge booking={booking} /></div>
                <Link className={styles.secondaryButton} href={customerBookingPath(booking.id)}>View payment <CustomerIcon name="arrow" /></Link>
              </article>
            );
          })}</div>
        ) : <CustomerEmptyState title="No payments yet">When you start checkout for a booking, its payment status will appear here.</CustomerEmptyState>}
      </div>
    </DashboardShell>
  );
}
