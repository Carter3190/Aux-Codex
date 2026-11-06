import Link from "next/link";
import { DashboardShell } from "./dashboard-shell";
import { CustomerIcon, type CustomerIconName } from "./customer-icon";
import { ProviderPaymentBadge } from "./provider-bookings";
import { ProviderStripeSetupCard } from "@/components/payments/provider-stripe-setup-card";
import type { ProviderWorkspace } from "@/lib/providers/types";
import type { BookingRequest } from "@/lib/marketplace/types";
import type { ProviderPaymentSetup } from "@/lib/payments/types";
import { customerCalendarDay, formatCustomerBookingDate } from "@/lib/marketplace/customer-dashboard";
import { providerBookingGroups, providerBookingPath } from "@/lib/marketplace/provider-dashboard";
import styles from "./provider-dashboard.module.css";

function ActionCard({ icon, title, children, href, action }: {
  icon: CustomerIconName; title: string; children: React.ReactNode; href: string; action: string;
}) {
  return <article className={styles.actionCard}>
    <span className={styles.serviceIcon}><CustomerIcon name={icon} /></span>
    <div><h3>{title}</h3><p>{children}</p><Link className={styles.textLink} href={href}>{action}<CustomerIcon name="arrow" /></Link></div>
  </article>;
}

export function ProviderOverview({ workspace, bookings, paymentSetup, serviceReviewNeeded }: {
  workspace: ProviderWorkspace; bookings: BookingRequest[]; paymentSetup: ProviderPaymentSetup;
  serviceReviewNeeded: boolean;
}) {
  const { profile, details, completion, reviewEvents } = workspace;
  const firstName = profile.fullName.trim().split(/\s+/)[0];
  const groups = providerBookingGroups(bookings, customerCalendarDay());
  const next = groups.upcoming[0];
  const approved = profile.providerStatus === "approved";
  const suspended = profile.providerStatus === "suspended";
  const rejected = profile.providerStatus === "rejected";
  const underReview = !approved && !suspended && !rejected && Boolean(details.submittedAt);
  const applicationAction = !approved && !suspended && !underReview;
  const serviceReviewAction = approved && serviceReviewNeeded;
  const stripeAction = approved && !paymentSetup.ready;
  const priceNeeded = approved ? groups.priceNeeded : [];
  const cases = groups.caseResponses;
  const needsAttention = Boolean(groups.requests.length || priceNeeded.length || cases.length || applicationAction || serviceReviewAction || stripeAction);
  const latestReview = reviewEvents[0];

  return <DashboardShell profile={profile} title={firstName ? `Welcome back, ${firstName}.` : "Welcome back."}>
    <div className={styles.page}>
      {suspended && <section className={`${styles.accountNotice} ${styles.noticeError}`}>
        <h2>Your provider account is suspended</h2><p>Contact Auxilium support for help with your account. Your existing bookings remain available below.</p>
        <Link href="/support" className={styles.textLink}>Contact support<CustomerIcon name="arrow" /></Link>
      </section>}
      {underReview && <section className={styles.accountNotice}>
        <h2>Your application is under review</h2><p>Auxilium is reviewing your profile and service requirements. You can review your application in Profile.</p>
        <Link href="/dashboard/provider/onboarding?section=review" className={styles.textLink}>Review application<CustomerIcon name="arrow" /></Link>
      </section>}
      {!approved && latestReview?.decision === "rejected" && latestReview.notes && <section className={`${styles.accountNotice} ${styles.noticeWarning}`}>
        <h2>Latest application feedback</h2><p className={styles.preserveLines}>{latestReview.notes}</p>
      </section>}
      <div className={styles.overviewGrid}>
        <section aria-labelledby="provider-next-visit">
          <div className={styles.sectionHeading}><h2 id="provider-next-visit">Next visit</h2><Link className={styles.textLink} href="/dashboard/provider/bookings">All bookings<CustomerIcon name="arrow" /></Link></div>
          {next ? <article className={styles.hero}>
            <div className={styles.heroTop}><span className={styles.badge}>Accepted</span><ProviderPaymentBadge booking={next} /></div>
            <div className={styles.heroMain}>
              <div className={styles.dateTile} aria-hidden="true"><span>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(`${next.requestedDate}T12:00:00`))}</span><strong>{Number(next.requestedDate.slice(8, 10))}</strong></div>
              <div><h3>{next.serviceName}</h3><p className={styles.heroCustomer}>{next.customerName}</p></div>
            </div>
            <p className={styles.heroTime}><CustomerIcon name="clock" />{formatCustomerBookingDate(next)}</p>
            <div className={styles.heroActions}><Link className={styles.heroButton} href={providerBookingPath(next.id)}>View booking<CustomerIcon name="arrow" /></Link><Link className={styles.heroLink} href={`/dashboard/messages/${next.id}`}><CustomerIcon name="messages" />Message customer</Link></div>
          </article> : <section className={`${styles.emptyState} ${styles.emptyFeatured}`}>
            <span className={styles.serviceIcon}><CustomerIcon name="calendar" /></span><h2>No upcoming visits</h2><p>Your next accepted, paid visit will appear here. Open requests and earlier bookings are available in Bookings.</p>
            <Link href="/dashboard/provider/bookings" className={styles.heroButton}>View bookings<CustomerIcon name="arrow" /></Link>
          </section>}
          {groups.pastOpen.length > 0 && <p className={styles.subtleNotice}><CustomerIcon name="clock" /><span>{groups.pastOpen.length === 1 ? "One earlier booking remains" : `${groups.pastOpen.length} earlier bookings remain`} open. <Link href="/dashboard/provider/bookings">Review booking status</Link></span></p>}
          {(details.businessName || profile.fullName) && <p className={styles.workspaceName}>{details.businessName || profile.fullName}</p>}
        </section>
        <div>
        <section aria-labelledby="provider-actions-heading">
          <div className={styles.sectionHeading}><h2 id="provider-actions-heading">{needsAttention ? "Needs your attention" : "Your activity"}</h2></div>
          <div className={styles.actionStack}>
            {applicationAction && <ActionCard icon="overview" title={rejected ? "Update your application" : "Finish your provider profile"} href="/dashboard/provider/onboarding?section=review" action={rejected ? "Review and update" : "Continue setup"}>
              {rejected ? "Review the feedback, update your profile, and submit it again." : `${completion.completedCount} of ${completion.totalCount} profile sections are complete. Finish your application and send it for review.`}
            </ActionCard>}
            {serviceReviewAction && <ActionCard icon="help" title="Service review needed" href="/dashboard/provider/onboarding?section=credentials" action="Review credentials">One or more services need an Auxilium review before they can take bookings. Keep any required documents current.</ActionCard>}
            {groups.requests.length > 0 && <ActionCard icon="calendar" title={groups.requests.length === 1 ? "1 new request" : `${groups.requests.length} new requests`} href="/dashboard/provider/bookings?filter=requests" action="Review requests">Review the job details and respond to your customers.</ActionCard>}
            {priceNeeded.length > 0 && <ActionCard icon="payments" title={priceNeeded.length === 1 ? "Set an agreed price" : `${priceNeeded.length} prices to confirm`} href={providerBookingPath(priceNeeded[0].id)} action="Set price">{priceNeeded[0].serviceName} · {priceNeeded[0].customerName}. The customer can pay once you confirm the price.</ActionCard>}
            {cases.length > 0 && <ActionCard icon="help" title={cases.length === 1 ? "Respond to a resolution request" : `${cases.length} resolution requests`} href={providerBookingPath(cases[0].id)} action="Review request">{cases[0].serviceName} · {cases[0].customerName}. Review the customer’s concern and add your response.</ActionCard>}
            {stripeAction && <div className={styles.stripeSetup}><ProviderStripeSetupCard setup={paymentSetup} /></div>}
            {!needsAttention && <article className={styles.actionCard}><span className={styles.serviceIcon}><CustomerIcon name="check" /></span><div><h3>No booking actions waiting</h3><p>Your bookings, conversations, and profile are available in the tabs above.</p></div></article>}
          </div>
        </section>
        </div>
      </div>
      {approved && paymentSetup.ready && paymentSetup.message && <p className={styles.statusNote}>{paymentSetup.message} <Link href="/dashboard/provider/payments">View payments</Link></p>}
    </div>
  </DashboardShell>;
}
