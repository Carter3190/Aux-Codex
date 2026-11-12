import Link from "next/link";
import { BookingCancelForm } from "./booking-cancel-form";
import { BookingCompletionForm } from "./booking-completion-form";
import { BookingReviewForm } from "./booking-review-form";
import { BookingResponseForm } from "./booking-response-form";
import { BookingDetailTabs } from "./booking-detail-tabs";
import { BookingCheckoutForm } from "@/components/payments/booking-checkout-form";
import { BookingPriceForm } from "@/components/payments/booking-price-form";
import { ProviderEarningsSummary } from "@/components/payments/provider-earnings-summary";
import { BookingCaseRequestForm } from "@/components/cases/booking-case-request-form";
import { BookingResolutionPanel } from "@/components/cases/booking-resolution-panel";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import type { ProviderEarnings } from "@/lib/payments/provider-earnings-types";
import type { BookingRequest } from "@/lib/marketplace/types";
import { customerCalendarDay, customerPaymentDue, customerPaymentLabel, formatCustomerMoney, formatCustomerBookingDate } from "@/lib/marketplace/customer-dashboard";
import { providerPaymentLabel } from "@/lib/marketplace/provider-dashboard";
import { formatPrice, labelFromSnakeCase } from "@/lib/providers/presentation";
import { bookingConversationWritable } from "@/lib/marketplace/booking-messaging";
import styles from "./booking-detail.module.css";

const activeCaseStatuses = new Set(["open", "provider_responded", "under_review"]);

export function BookingCard({ booking, perspective, providerEarnings }: {
  booking: BookingRequest; perspective: "customer" | "provider"; providerEarnings?: ProviderEarnings;
}) {
  const paymentStatus = booking.payment?.status;
  const paid = paymentStatus === "paid" || paymentStatus === "partially_refunded";
  const terminalPayment = paid || paymentStatus === "refunded";
  const paymentEditable = !paymentStatus || paymentStatus === "failed" || paymentStatus === "expired";
  const canSetPrice = ["accepted", "completed"].includes(booking.status) && paymentEditable;
  const canComplete = booking.status === "accepted" && booking.agreedPriceCents !== null &&
    booking.requestedDate <= customerCalendarDay() && (paymentEditable || paid);
  const paymentDue = customerPaymentDue(booking);
  const completedUnpaid = booking.status === "completed" && !terminalPayment;
  const canMessage = bookingConversationWritable(booking);
  const canCancel = ["pending", "accepted"].includes(booking.status) && paymentEditable;
  const remainingRefundCents = booking.payment ? booking.payment.amountCents - booking.payment.refundedAmountCents : 0;
  const activeCase = Boolean(booking.supportCase && activeCaseStatuses.has(booking.supportCase.status));
  const counterpart = perspective === "customer" ? booking.providerName : booking.customerName;
  const initials = counterpart.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const paymentTone = paid ? styles.paid : paymentStatus === "failed" ? styles.error :
    paymentStatus === "refunded" ? styles.neutral : paymentDue ? styles.warning : "";
  const displayedPaymentLabel = perspective === "provider" ? providerPaymentLabel(booking) : customerPaymentLabel(booking);
  const statusText = booking.status === "completed" ? "This visit is complete." :
    booking.status === "accepted" ? paid ? "Payment is confirmed." :
      booking.agreedPriceCents === null ? "Confirm the agreed price before marking the work complete." : "The agreed price is ready." :
    booking.status === "pending" ? "Review the request and respond to your customer." :
    booking.status === "cancelled" ? "This booking has been cancelled." : "This request was declined.";
  const customerStatusText = booking.status === "completed" ? "This visit is complete." :
    booking.status === "accepted" ? paid ? "Your visit is accepted and payment is confirmed." : "Your visit is accepted. Payment is due after the work is finished." :
    booking.status === "pending" ? "Your provider will review your request and respond here." :
    booking.status === "cancelled" ? "This booking has been cancelled." : "The provider declined this request.";

  const overview = <div className={styles.overviewGrid}>
    <div className={styles.stack}>
      <section className={styles.panel} aria-label="Visit details">
        <h3>Visit details</h3>
        <dl className={styles.facts}>
          <div><dt>Requested time</dt><dd>{formatCustomerBookingDate(booking)}</dd></div>
          <div><dt>Service location</dt><dd>{booking.serviceLocation}</dd></div>
          <div><dt>Listed pricing</dt><dd>{formatPrice(booking.pricingType, booking.priceCents)}</dd></div>
          {booking.agreedPriceCents !== null && <div><dt>Agreed booking price</dt><dd>{formatCustomerMoney(booking.agreedPriceCents)}</dd></div>}
        </dl>
      </section>
      {(booking.customerNotes || booking.providerResponse) && <section className={styles.panel} aria-label="Booking notes">
        <h3>Booking notes</h3>
        {booking.customerNotes && <div className={styles.caseNotes}><h4>Customer note</h4><p className={styles.preserve}>{booking.customerNotes}</p></div>}
        {booking.providerResponse && <div className={styles.caseNotes}><h4>Provider response</h4><p className={styles.preserve}>{booking.providerResponse}</p></div>}
      </section>}
    </div>
    <section className={styles.panel} aria-label={perspective === "customer" ? "Your provider" : "Your customer"}>
      <div className={styles.person}><span className={styles.avatar} aria-hidden="true">{initials}</span><div><h3>{counterpart}</h3><p>Your {perspective === "customer" ? "provider" : "customer"}</p></div></div>
      <p className={styles.statusText}>{perspective === "provider" ? statusText : customerStatusText}</p>
      {completedUnpaid && <p>{paymentStatus === "processing" ? "Payment is processing. Stripe will confirm the payment status here." : booking.agreedPriceCents === null ? "The final price still needs to be confirmed." : perspective === "provider" ? "Customer payment is still outstanding. You can review its status in Payment." : "Open Payment to review the agreed price and pay for your visit."}</p>}
      <Link href={`/dashboard/messages/${booking.id}`} className={styles.secondary}><CustomerIcon name="messages" />{canMessage ? `Message ${perspective === "customer" ? "provider" : "customer"}` : "View conversation"}</Link>
      {perspective === "provider" && booking.status === "pending" && <BookingResponseForm bookingId={booking.id} />}
      {perspective === "provider" && canComplete && <div className={styles.completion}><BookingCompletionForm bookingId={booking.id} paymentReceived={paid} /></div>}
      {perspective === "provider" && booking.status === "accepted" && !canComplete && <p className={styles.note}>{booking.agreedPriceCents === null ? "Set the agreed price in Payment before marking this visit complete." : booking.requestedDate > customerCalendarDay() ? "Mark the service complete after the work is finished, on or after the scheduled visit date." : paymentStatus === "checkout_pending" || paymentStatus === "processing" ? "An earlier payment attempt must finish or expire before this visit can be marked complete." : "Contact support if this booking’s payment status needs review."}</p>}
    </section>
  </div>;

  const payment = <section className={styles.panel}>
    <div className={styles.paymentHeading}><div><h3>Payment details</h3><span className={styles.paymentAmount}>{booking.agreedPriceCents === null ? "Price not set" : formatCustomerMoney(booking.agreedPriceCents)}</span></div><span className={`${styles.badge} ${paymentTone}`}>{displayedPaymentLabel}</span></div>
    {booking.agreedPriceCents === null ? <p>{perspective === "provider" ? "Save the full price agreed with your customer." : "Waiting for the provider to confirm the final price."}</p> :
      booking.status === "accepted" && !terminalPayment ? <p>The agreed price is ready. Payment becomes due once the work is finished and the visit is marked complete.</p> :
      completedUnpaid ? <p>{paymentStatus === "processing" ? "Stripe is confirming this payment. No additional payment is needed while it processes." : perspective === "provider" ? "The work is complete and payment is due from the customer." : "The work is complete. Review the agreed price before paying."}</p> : null}
    {perspective === "provider" && <ProviderEarningsSummary booking={booking} earnings={providerEarnings} />}
    {perspective === "customer" && booking.payment && booking.payment.refundedAmountCents > 0 && <p>Refunded: {formatCustomerMoney(booking.payment.refundedAmountCents)} of {formatCustomerMoney(booking.payment.amountCents)}</p>}
    {perspective === "customer" && paymentDue && <BookingCheckoutForm bookingId={booking.id} paymentStatus={paymentStatus ?? null} />}
    {perspective === "provider" && canSetPrice && <BookingPriceForm bookingId={booking.id} defaultAmountCents={booking.agreedPriceCents ?? booking.priceCents} hasAgreedPrice={booking.agreedPriceCents !== null} />}
    {perspective === "provider" && <p className={styles.note}>Auxilium’s platform commission is 5%. Stripe confirms its processing fee after payment. Available earnings are deposited according to your Stripe payout schedule.</p>}
  </section>;

  const help = <div className={styles.stack}>
    <BookingResolutionPanel booking={booking} perspective={perspective} />
    {perspective === "customer" && paid && !activeCase && remainingRefundCents >= 100 && <BookingCaseRequestForm
      bookingId={booking.id}
      remainingRefundCents={remainingRefundCents}
      allowCancellation={booking.status === "accepted"}
      bookingContext={{ serviceName: booking.serviceName, providerName: booking.providerName,
        paidAmountCents: booking.payment!.amountCents,
        paymentLabel: paymentStatus === "partially_refunded" ? "Partially refunded" : "Paid" }}
    />}
    {perspective === "customer" && canCancel && <section className={styles.panel}><h3>Cancel this request</h3><p>No successful payment has been collected. Cancelling an unpaid request does not require a refund.</p><BookingCancelForm bookingId={booking.id} /></section>}
    <section className={styles.panel}><h3>Need help with this visit?</h3><p>{completedUnpaid ? "Contact your provider to discuss the completed work or agreed price. Contact Auxilium support if you need help resolving a concern." : "Use your booking conversation to coordinate with the other party. Auxilium support can help with account or booking issues."}</p><Link href="/support" className={styles.secondary}>Contact support<CustomerIcon name="arrow" /></Link></section>
  </div>;

  const review = <section className={styles.panel}>
    {booking.review ? <><h3>{perspective === "customer" ? "Your verified review" : "Verified customer review"}</h3><p className={styles.reviewRating} aria-label={`${booking.review.rating} out of 5 stars`}>{"★".repeat(booking.review.rating)}{"☆".repeat(5 - booking.review.rating)}</p><p className={styles.preserve}>{booking.review.body}</p><div className={styles.reviewDate}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(booking.review.createdAt))}</div></> :
      perspective === "customer" && booking.status === "completed" && paid ? <><h3>How did your visit go?</h3><BookingReviewForm bookingId={booking.id} /></> :
      <><h3>No review yet</h3><p>{perspective === "customer" ? "You can leave a verified review after the visit is complete and payment is confirmed." : "Your customer can leave a verified review after the visit is complete and payment is confirmed."}</p></>}
  </section>;

  return <article className={styles.detail}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Booking details</p><h2>{booking.serviceName}</h2><p>{counterpart}</p></div><div className={styles.badges}><span className={`${styles.badge} ${booking.status === "pending" ? styles.warning : styles.neutral}`}>{booking.status === "completed" ? "Complete" : labelFromSnakeCase(booking.status)}</span><span className={`${styles.badge} ${paymentTone}`}>{displayedPaymentLabel}</span></div></header>
    <BookingDetailTabs overview={overview} payment={payment} help={help} review={review} paymentDue={perspective === "customer" && paymentDue} />
  </article>;
}
