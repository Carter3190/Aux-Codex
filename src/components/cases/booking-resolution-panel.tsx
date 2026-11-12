import type { BookingRequest } from "@/lib/marketplace/types";
import { formatCustomerMoney } from "@/lib/marketplace/customer-dashboard";
import { labelFromSnakeCase } from "@/lib/providers/presentation";
import { ProviderCaseResponseForm } from "./provider-case-response-form";
import styles from "./resolution-response.module.css";

const activeCaseStatuses = new Set(["open", "provider_responded", "under_review"]);

export function BookingResolutionPanel({ booking, perspective }: {
  booking: BookingRequest;
  perspective: "customer" | "provider";
}) {
  const supportCase = booking.supportCase;
  if (!supportCase) return null;

  const canRespond = perspective === "provider" &&
    activeCaseStatuses.has(supportCase.status) && supportCase.status !== "under_review";
  const responseNeeded = canRespond && !supportCase.providerResponse;

  return (
    <section className={styles.workspace} aria-label="Resolution request">
      <header className={styles.heading}>
        <p className={styles.eyebrow}>Booking support</p>
        <h3>{canRespond ? "Respond to a resolution request" : "Resolution request"}</h3>
        {canRespond && <p>Review the customer’s concern and send your response to Auxilium.</p>}
      </header>
      <div className={canRespond ? styles.columns : styles.single}>
        <section className={styles.card} aria-label={perspective === "provider" ? "Customer’s request" : "Your request"}>
          <div className={styles.cardHeading}>
            <h3 className={styles.cardTitle}>{perspective === "provider" ? "Customer’s request" : "Your request"}</h3>
            <span className={`${styles.badge} ${responseNeeded ? styles.responseNeeded : ""}`}>
              {responseNeeded ? "Response needed" : labelFromSnakeCase(supportCase.status)}
            </span>
          </div>
          <dl className={styles.facts}>
            <div><dt>Booking reference</dt><dd className={styles.reference}>{booking.id}</dd></div>
            <div><dt>{perspective === "provider" ? "Customer" : "Provider"}</dt><dd>{perspective === "provider" ? booking.customerName : booking.providerName}</dd></div>
            <div><dt>Request type</dt><dd>{labelFromSnakeCase(supportCase.category)}</dd></div>
            <div><dt>Requested refund</dt><dd>{formatCustomerMoney(supportCase.requestedRefundCents)}</dd></div>
          </dl>
          <blockquote className={styles.statement}><p>{supportCase.customerDetails}</p></blockquote>
          {supportCase.providerResponse && <section className={styles.note} aria-label="Provider response">
            <h4>Provider response</h4><p>{supportCase.providerResponse}</p>
          </section>}
          {supportCase.adminNotes && <section className={styles.note} aria-label="Auxilium decision notes">
            <h4>Auxilium decision notes</h4><p>{supportCase.adminNotes}</p>
          </section>}
          {canRespond && <p className={styles.caption}>Your response is sent to Auxilium for review.</p>}
        </section>
        {canRespond && <ProviderCaseResponseForm caseId={supportCase.id} />}
      </div>
    </section>
  );
}
