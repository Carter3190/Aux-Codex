import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, PolicySection } from "@/components/legal/policy-page";

export const metadata: Metadata = {
  title: "Cancellation, refund, and dispute policy",
  description: "How Auxilium handles booking cancellations, refund requests, and payment disputes.",
  alternates: { canonical: "/cancellation-refunds" },
};

export default function CancellationRefundsPage() {
  return (
    <PolicyPage
      eyebrow="Booking policy"
      title="Cancellations, refunds, and disputes"
      summary="This policy explains what happens when plans change, a service problem occurs, or a payment needs review."
      updated="September 21, 2026"
    >
      <PolicySection title="Before a booking is paid">
        <p>
          A customer may cancel a pending or accepted request from the dashboard
          while no successful payment is attached. A provider may decline a
          request. Because no payment has been completed, there is no Auxilium
          refund to issue at this stage.
        </p>
        <p>
          Customers should review the provider’s final price, requested time,
          service description, and location before entering Stripe Checkout.
        </p>
      </PolicySection>

      <PolicySection title="After payment">
        <p>
          Once payment is complete, cancellation and refund questions must be
          submitted as a private resolution request from the applicable booking
          in the customer dashboard. The customer selects the issue type,
          requested amount, and explanation. The provider may respond, and an
          Auxilium administrator reviews the available booking, payment,
          message, and participant records.
        </p>
        <p>
          Opening a request does not guarantee a refund. Auxilium may approve a
          full refund, approve a partial refund, deny the request, or close it
          when the issue is resolved another way. Approved refunds are sent to
          the original payment method through Stripe and may take several
          business days to appear, depending on the bank or card issuer.
        </p>
      </PolicySection>

      <PolicySection title="How decisions are made">
        <p>Relevant factors may include:</p>
        <ul>
          <li>the agreed scope, price, date, and provider response;</li>
          <li>whether and to what extent the service was performed;</li>
          <li>timing and reason for cancellation;</li>
          <li>messages, photos, receipts, or other reliable evidence;</li>
          <li>safety, fraud, duplicate-charge, and legal considerations;</li>
          <li>amounts already refunded or no longer refundable through Stripe.</li>
        </ul>
        <p>
          Submit a request promptly after learning of the problem. Delayed
          reports may be harder to verify and can be limited by payment-network
          deadlines.
        </p>
      </PolicySection>

      <PolicySection title="Provider cancellations and service problems">
        <p>
          Providers should notify customers as soon as possible when they cannot
          perform accepted work. Repeated cancellations, nonattendance,
          materially inaccurate descriptions, unsafe conduct, or refusal to
          cooperate with a review may lead to refunds and account restrictions.
        </p>
        <p>
          Customers should give the provider a reasonable opportunity to respond
          when safe and appropriate, but should not continue an interaction that
          feels unsafe. For an immediate threat or emergency, contact local
          emergency services rather than Auxilium.
        </p>
      </PolicySection>

      <PolicySection title="Card disputes and chargebacks">
        <p>
          A card dispute opened with a bank is handled under Stripe and card-
          network rules. Auxilium may share relevant transaction and service
          evidence with Stripe. A bank’s final decision can differ from an
          Auxilium resolution decision. Users must not seek duplicate recovery
          through both a platform refund and a chargeback.
        </p>
      </PolicySection>

      <PolicySection title="Get help">
        <p>
          For a paid booking, sign in and open the resolution request inside that
          booking so it stays attached to the correct payment. For access or
          general questions, use the <Link href="/support">Support Center</Link>.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
