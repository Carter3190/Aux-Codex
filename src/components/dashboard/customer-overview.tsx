import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import { CustomerCheckoutFeedback, CustomerEmptyState, CustomerPaymentBadge } from "@/components/dashboard/customer-bookings";
import styles from "@/components/dashboard/customer-dashboard.module.css";
import type { CurrentProfile } from "@/lib/auth/profile";
import type { BookingRequest } from "@/lib/marketplace/types";
import { customerBookingGroups, customerBookingPath, customerPaymentDue, formatCustomerBookingDate, formatCustomerMoney } from "@/lib/marketplace/customer-dashboard";

export function CustomerOverview({ profile, bookings, payment }: {
  profile: CurrentProfile;
  bookings: BookingRequest[];
  payment?: string;
}) {
  const firstName = profile.fullName.trim().split(/\s+/)[0];
  const groups = customerBookingGroups(bookings);
  const next = groups.upcoming[0];
  const paymentsDue = bookings.filter(customerPaymentDue);
  const reviewDue = bookings.find((booking) => booking.status === "completed" && !booking.review && (booking.payment?.status === "paid" || booking.payment?.status === "partially_refunded"));
  const processing = bookings.find((booking) => booking.payment?.status === "processing");
  const waiting = bookings.find((booking) => booking.status === "pending");

  return (
    <DashboardShell profile={profile}
      title={firstName ? `How can we help you today, ${firstName}?` : "How can we help you today?"}>
      <div className={styles.page}>
        <CustomerCheckoutFeedback payment={payment} />
        {paymentsDue.length > 0 && (
          <section className={styles.actionSection} aria-labelledby="customer-attention-heading">
            <div className={styles.sectionHeading}><h2 id="customer-attention-heading">Needs your attention</h2></div>
            <div className={styles.attentionStack}>
              {paymentsDue.map((booking) => (
                <article className={styles.attention} key={booking.id}>
                  <div className={styles.attentionTitle}>
                    <CustomerIcon name="payments" />
                    <h3>{booking.payment?.status === "failed" ? "Your payment didn’t go through" : "Your booking price is ready"}</h3>
                  </div>
                  <p>{booking.providerName} · {booking.serviceName}. {booking.payment?.status === "failed"
                    ? `Review the booking and try again when you’re ready. The final price is ${formatCustomerMoney(booking.agreedPriceCents!)}.`
                    : `Review the final price of ${formatCustomerMoney(booking.agreedPriceCents!)} before paying to confirm your visit.`}</p>
                  <Link className={styles.textLink} href={customerBookingPath(booking.id)}>{booking.payment?.status === "failed" ? "Review payment" : "Review & pay"}<CustomerIcon name="arrow" /></Link>
                </article>
              ))}
            </div>
          </section>
        )}
        <div className={styles.overviewGrid}>
          <section aria-labelledby="next-visit-heading">
            <div className={styles.sectionHeading}>
              <h2 id="next-visit-heading">Coming up</h2>
              <Link className={styles.textLink} href="/dashboard/customer/bookings?filter=upcoming">All bookings <CustomerIcon name="arrow" /></Link>
            </div>
            {next ? (
              <article className={styles.hero}>
                <div className={styles.heroTop}><span className={styles.heroLabel}>Your next visit</span><CustomerPaymentBadge booking={next} /></div>
                <div className={styles.heroMain}>
                  <div className={styles.dateTile} aria-hidden="true">
                    <span>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(`${next.requestedDate}T12:00:00`))}</span>
                    <strong>{Number(next.requestedDate.slice(8, 10))}</strong>
                  </div>
                  <div><h3>{next.serviceName}</h3><p className={styles.heroProvider}>{next.providerName}</p></div>
                </div>
                <p className={styles.heroTime}><CustomerIcon name="clock" />{formatCustomerBookingDate(next)}</p>
                <div className={styles.heroActions}>
                  <Link className={styles.heroButton} href={customerBookingPath(next.id)}>View booking <CustomerIcon name="arrow" /></Link>
                  <Link className={styles.heroLink} href={`/dashboard/messages/${next.id}`}><CustomerIcon name="messages" />Message provider</Link>
                </div>
              </article>
            ) : (
              <CustomerEmptyState title="A little help starts here." browse featured>
                {bookings.length ? "You have no upcoming visits. Your open requests and earlier bookings are available in Bookings." : "Find local help and send your first request. Your next appointment will appear here."}
              </CustomerEmptyState>
            )}
            {groups.pastOpen.length > 0 && (
              <p className={styles.subtleNotice}><CustomerIcon name="clock" />
                <span>{groups.pastOpen.length === 1 ? "One booking has" : `${groups.pastOpen.length} bookings have`} a past visit date and {groups.pastOpen.length === 1 ? "remains" : "remain"} open. <Link href="/dashboard/customer/bookings">View open bookings</Link></span>
              </p>
            )}
          </section>
          <section aria-labelledby="customer-activity-heading">
            <div className={styles.sectionHeading}><h2 id="customer-activity-heading">Your activity</h2></div>
            <div className={styles.attentionStack}>
              <article className={styles.updateCard}>
                <span className={styles.serviceIcon}><CustomerIcon name="book" /></span>
                <div>
                  <h3>Visit previous bookings</h3>
                  <p>Review your booking details and follow up with your providers.</p>
                  <Link className={styles.textLink} href="/dashboard/customer/bookings">View bookings<CustomerIcon name="arrow" /></Link>
                </div>
              </article>
              {reviewDue && (
                <article className={styles.updateCard}>
                  <span className={styles.serviceIcon}><CustomerIcon name="check" /></span>
                  <div>
                    <h3>How did your visit go?</h3>
                    <p>Share your experience with {reviewDue.providerName} after your completed visit.</p>
                    <Link className={styles.textLink} href={customerBookingPath(reviewDue.id)}>Leave a review<CustomerIcon name="arrow" /></Link>
                  </div>
                </article>
              )}
              {processing && (
                <article className={styles.updateCard}>
                  <span className={styles.serviceIcon}><CustomerIcon name="clock" /></span>
                  <div>
                    <h3>Your payment is processing</h3>
                    <p>Stripe is confirming your payment. Open the booking for its current payment status.</p>
                    <Link className={styles.textLink} href={customerBookingPath(processing.id)}>View booking<CustomerIcon name="arrow" /></Link>
                  </div>
                </article>
              )}
              <article className={styles.updateCard}>
                <span className={styles.serviceIcon}><CustomerIcon name={waiting ? "clock" : "messages"} /></span>
                <div>
                  <h3>{waiting ? "Awaiting a provider" : "Keep in touch"}</h3>
                  <p>{waiting ? `${waiting.serviceName} · Waiting for ${waiting.providerName} to respond.` : "Your booking conversations are ready whenever you need to coordinate a visit."}</p>
                  <Link className={styles.textLink} href={waiting ? customerBookingPath(waiting.id) : "/dashboard/messages"}>{waiting ? "View request" : "Open messages"}<CustomerIcon name="arrow" /></Link>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}

