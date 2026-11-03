import Link from "next/link";
import type { BookingRequest } from "@/lib/marketplace/types";
import { customerBookingPath, customerPaymentLabel, formatCustomerBookingDate, formatCustomerMoney } from "@/lib/marketplace/customer-dashboard";
import { labelFromSnakeCase } from "@/lib/providers/presentation";
import { CustomerIcon } from "./customer-icon";
import styles from "./customer-dashboard.module.css";

export function CustomerPaymentBadge({ booking }: { booking: BookingRequest }) {
  const status = booking.payment?.status;
  const tone = status === "paid" ? styles.paid
    : status === "failed" ? styles.failed
    : status === "processing" || status === "partially_refunded" ? styles.processing
    : status === "refunded" ? styles.neutral : styles.waiting;
  return <span className={`${styles.badge} ${tone}`}>
    {status === "paid" && <CustomerIcon name="check" />}
    {customerPaymentLabel(booking)}
  </span>;
}

export function CustomerBookingSummary({ booking }: { booking: BookingRequest }) {
  return (
    <article className={styles.bookingCard}>
      <div className={styles.bookingCardTop}>
        <span className={styles.serviceIcon}><CustomerIcon name="calendar" /></span>
        <div className={styles.bookingTitle}>
          <h2><Link href={customerBookingPath(booking.id)}>{booking.serviceName}</Link></h2>
          <p>{booking.providerName}</p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles.neutral}`}>{labelFromSnakeCase(booking.status)}</span>
          <CustomerPaymentBadge booking={booking} />
        </div>
      </div>
      <div className={styles.bookingCardBottom}>
        <p className={styles.dateLine}><CustomerIcon name="clock" />{formatCustomerBookingDate(booking)}</p>
        {booking.agreedPriceCents !== null && <span className={styles.amount}>{formatCustomerMoney(booking.agreedPriceCents)}</span>}
        <Link className={styles.secondaryButton} href={customerBookingPath(booking.id)}>View details <CustomerIcon name="arrow" /></Link>
      </div>
    </article>
  );
}

export function CustomerEmptyState({ title, children, browse = false, featured = false }: {
  title: string; children: React.ReactNode; browse?: boolean; featured?: boolean;
}) {
  return (
    <section className={`${styles.emptyState} ${featured ? styles.emptyFeatured : ""}`}>
      <span className={styles.serviceIcon}><CustomerIcon name="calendar" /></span>
      <h2>{title}</h2><p>{children}</p>
      {browse && <Link className={styles.primaryButton} href="/providers">Browse providers <CustomerIcon name="arrow" /></Link>}
    </section>
  );
}

export function CustomerCheckoutFeedback({ payment }: { payment?: string }) {
  if (payment !== "success" && payment !== "cancelled") return null;
  return (
    <section className={`${styles.feedback} ${payment === "cancelled" ? styles.feedbackWarning : ""}`} role="status">
      <CustomerIcon name={payment === "success" ? "check" : "pending"} />
      <div>
        <h2>{payment === "success" ? "Stripe checkout completed." : "Checkout was not completed."}</h2>
        <p>{payment === "success"
          ? "Your payment is being confirmed. The booking’s payment status will show Paid once Stripe confirmation is reconciled."
          : "No new payment was confirmed. You can continue secure checkout from the booking’s details."}</p>
        <Link href="/dashboard/customer/bookings" className={styles.textLink}>View your bookings <CustomerIcon name="arrow" /></Link>
      </div>
    </section>
  );
}
