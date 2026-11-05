import Link from "next/link";
import type { BookingRequest } from "@/lib/marketplace/types";
import { formatCustomerBookingDate, formatCustomerMoney } from "@/lib/marketplace/customer-dashboard";
import { providerBookingPath, providerPaymentLabel } from "@/lib/marketplace/provider-dashboard";
import { labelFromSnakeCase } from "@/lib/providers/presentation";
import { CustomerIcon } from "./customer-icon";
import styles from "./provider-dashboard.module.css";

export function ProviderPaymentBadge({ booking }: { booking: BookingRequest }) {
  const status = booking.payment?.status;
  const tone = status === "paid" ? styles.paid : status === "failed" ? styles.failed
    : status === "processing" || status === "partially_refunded" ? styles.processing : styles.neutral;
  return <span className={`${styles.badge} ${tone}`}>
    {status === "paid" && <CustomerIcon name="check" />}{providerPaymentLabel(booking)}
  </span>;
}

export function ProviderBookingSummary({ booking }: { booking: BookingRequest }) {
  return <article className={styles.bookingCard}>
    <div className={styles.bookingCardTop}>
      <span className={styles.serviceIcon}><CustomerIcon name="calendar" /></span>
      <div className={styles.bookingTitle}>
        <h2><Link href={providerBookingPath(booking.id)}>{booking.serviceName}</Link></h2><p>{booking.customerName}</p>
      </div>
      <div className={styles.badges}>
        <span className={`${styles.badge} ${styles.neutral}`}>{booking.status === "pending" ? "New request" : labelFromSnakeCase(booking.status)}</span>
        <ProviderPaymentBadge booking={booking} />
      </div>
    </div>
    <div className={styles.bookingCardBottom}>
      <p className={styles.dateLine}><CustomerIcon name="clock" />{formatCustomerBookingDate(booking)}</p>
      {booking.agreedPriceCents !== null && <span className={styles.amount}>{formatCustomerMoney(booking.agreedPriceCents)}</span>}
      <Link className={styles.secondaryButton} href={providerBookingPath(booking.id)}>{booking.status === "pending" ? "Review request" : "View booking"}<CustomerIcon name="arrow" /></Link>
    </div>
  </article>;
}

export function ProviderEmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={styles.emptyState}><span className={styles.serviceIcon}><CustomerIcon name="calendar" /></span><h2>{title}</h2><p>{children}</p></section>;
}
