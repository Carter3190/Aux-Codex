import type { CurrentProfile } from "@/lib/auth/profile";
import type { BookingRequest } from "@/lib/marketplace/types";
import type { ProviderPaymentSetup } from "@/lib/payments/types";
import type { ProviderEarnings } from "@/lib/payments/provider-earnings-types";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerPaymentBadge } from "@/components/dashboard/customer-bookings";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import { ProviderStripeSetupCard } from "@/components/payments/provider-stripe-setup-card";
import styles from "@/components/payments/provider-payments.module.css";
import { formatCustomerMoney } from "@/lib/marketplace/customer-dashboard";

const capturedStatuses = new Set(["paid", "partially_refunded", "refunded"]);
const deduction = (cents: number) => formatCustomerMoney(cents === 0 ? 0 : -cents);

export function ProviderPayments({ profile, bookings, setup, earnings, pagination }: {
  profile: CurrentProfile;
  bookings: BookingRequest[];
  setup: ProviderPaymentSetup;
  earnings: Record<string, ProviderEarnings>;
  pagination?: { page: number; pageCount: number; totalPayments: number };
}) {
  const payments = bookings.filter((booking) => booking.payment !== null);
  const captured = payments.filter((booking) => capturedStatuses.has(booking.payment!.status) && earnings[booking.id]?.status !== "test");
  const totals = captured.reduce((sum, booking) => {
    const payment = booking.payment!;
    const amounts = earnings[booking.id];
    const platformFee = amounts?.platformFeeCents ?? null;
    sum.gross += payment.amountCents;
    sum.refunded += amounts?.refundedAmountCents ?? payment.refundedAmountCents;
    if (platformFee === null) sum.platformPending = true;
    else sum.platform += platformFee;
    if (amounts?.stripeFeeCents === null || amounts?.stripeFeeCents === undefined) sum.stripePending = true;
    else sum.stripe += amounts.stripeFeeCents;
    if (amounts?.status !== "confirmed" || amounts.netEarningsCents === null) sum.netPending = true;
    else sum.net += amounts.netEarningsCents;
    return sum;
  }, { gross: 0, refunded: 0, platform: 0, stripe: 0, net: 0, platformPending: false, stripePending: false, netPending: false });

  return (
    <DashboardShell profile={profile} title="Your payments.">
      <div className={styles.setup}><ProviderStripeSetupCard setup={setup} /></div>
      <section className={styles.history} aria-labelledby="provider-payment-history">
        <h2 id="provider-payment-history">Payment history</h2>
        {payments.length ? (
          <>
            <table className={styles.table}>
              <caption className={styles.caption}>Payment fees and earnings for your bookings</caption>
              <thead><tr><th scope="col">Booking</th><th scope="col">Customer total</th><th scope="col">Refunds</th><th scope="col">Auxilium fee</th><th scope="col">Stripe fee</th><th scope="col">Net earnings</th></tr></thead>
              <tbody>{payments.map((booking) => {
                const payment = booking.payment!;
                const amounts = earnings[booking.id];
                const isTest = amounts?.status === "test";
                const platformFee = amounts?.platformFeeCents ?? (!capturedStatuses.has(payment.status) && payment.refundedAmountCents === 0 ? payment.platformFeeCents : null);
                const feePlaceholder = isTest ? "—" : amounts?.status === "unavailable" ? "Unavailable" : capturedStatuses.has(payment.status) ? "Pending fee details" : "After payment";
                return (
                  <tr key={booking.id}>
                    <td className={styles.booking}>
                      <Link href={`/dashboard/provider/bookings/${booking.id}`}>{booking.serviceName}<CustomerIcon name="arrow" /></Link>
                      <p>{booking.customerName}</p>
                      {payment.paidAt && <p>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(payment.paidAt))}</p>}
                      <CustomerPaymentBadge booking={booking} />
                      {isTest && <p>Stripe test payment</p>}
                    </td>
                    <td data-label="Customer total">{formatCustomerMoney(payment.amountCents)}</td>
                    <td data-label="Refunds">{deduction(amounts?.refundedAmountCents ?? payment.refundedAmountCents)}</td>
                    <td data-label="Auxilium fee">{isTest ? "—" : platformFee === null ? "Pending fee details" : deduction(platformFee)}</td>
                    <td data-label="Stripe fee">{amounts?.stripeFeeCents === null || amounts?.stripeFeeCents === undefined ? feePlaceholder : deduction(amounts.stripeFeeCents)}</td>
                    <td data-label="Net earnings" className={styles.net}>{amounts?.status === "confirmed" && amounts.netEarningsCents !== null ? formatCustomerMoney(amounts.netEarningsCents) : feePlaceholder}</td>
                  </tr>
                );
              })}</tbody>
              {captured.length > 0 && <tfoot><tr><th scope="row">Collected payments</th><td data-label="Customer total">{formatCustomerMoney(totals.gross)}</td><td data-label="Refunds">{deduction(totals.refunded)}</td><td data-label="Auxilium fee">{totals.platformPending ? "Pending fee details" : deduction(totals.platform)}</td><td data-label="Stripe fee">{totals.stripePending ? "Pending fee details" : deduction(totals.stripe)}</td><td data-label="Net earnings" className={styles.net}>{totals.netPending ? "Pending fee details" : formatCustomerMoney(totals.net)}</td></tr></tfoot>}
            </table>
            {pagination && pagination.pageCount > 1 && <nav className={styles.pagination} aria-label="Payment history pages"><p>Page {pagination.page} of {pagination.pageCount} · {pagination.totalPayments} payments</p><div>{pagination.page > 1 && <Link href={`/dashboard/provider/payments?page=${pagination.page - 1}`}>Previous</Link>}{pagination.page < pagination.pageCount && <Link href={`/dashboard/provider/payments?page=${pagination.page + 1}`}>Next<CustomerIcon name="arrow" /></Link>}</div></nav>}
            <p className={styles.note}>Net earnings use the recorded payment fees and refunds. Auxilium’s platform commission is 5%. Fee returns are reflected after refunds. Totals cover this page and exclude test payments and unpaid or processing checkouts. A payment and its bank deposit are separate events.</p>
            <p className={styles.note}>If a fee is still pending, open the booking for its details. Actual fees appear once Stripe makes them available.</p>
          </>
        ) : <p className={styles.empty}>No payment activity yet. Payment details will appear here when a customer starts checkout.</p>}
      </section>
    </DashboardShell>
  );
}
