import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, PolicySection } from "@/components/legal/policy-page";

export const metadata: Metadata = {
  title: "Provider agreement",
  description: "Terms for professionals offering services through Auxilium.",
  alternates: { canonical: "/provider-agreement" },
};

export default function ProviderAgreementPage() {
  return (
    <PolicyPage
      eyebrow="For providers"
      title="Provider agreement"
      summary="This agreement supplements the Terms of Service for every person or business that applies to offer services through Auxilium."
      updated="September 21, 2026"
    >
      <PolicySection title="1. Provider relationship">
        <p>
          Providers operate independent businesses. Nothing in this agreement
          creates an employment, agency, partnership, joint-venture, or franchise
          relationship with Auxilium. Providers control whether to accept
          requests and how to perform the work, subject to the agreed booking,
          applicable law, and platform standards.
        </p>
        <p>
          Providers are responsible for their personnel, tools, transportation,
          expenses, taxes, licenses, permits, insurance, and service results.
        </p>
      </PolicySection>

      <PolicySection title="2. Application and continuing accuracy">
        <p>
          A provider must submit truthful, complete profile and credential
          information and keep it current. Auxilium may request identity,
          business, license, insurance, or other documentation relevant to the
          services offered. Approval is discretionary and may be revisited when
          information changes or concerns arise.
        </p>
        <p>
          An approval badge means the submitted application passed Auxilium’s
          review process at that time. It is not a warranty of future conduct and
          does not replace a customer’s own evaluation.
        </p>
      </PolicySection>

      <PolicySection title="3. Service obligations">
        <ul>
          <li>Offer only services the provider is competent and legally allowed to perform.</li>
          <li>Use accurate pricing, descriptions, availability, and service-area information.</li>
          <li>Respond professionally and arrive as agreed or communicate changes promptly.</li>
          <li>Follow safety requirements, building rules, permits, and industry standards.</li>
          <li>Protect customer property and confidential or personal information.</li>
          <li>Do not discriminate, harass, threaten, retaliate, or misrepresent qualifications.</li>
        </ul>
        <p>
          The full <Link href="/provider-standards">Provider Standards</Link>
          are incorporated into this agreement.
        </p>
      </PolicySection>

      <PolicySection title="4. Bookings and customer communication">
        <p>
          Providers may accept or decline requests but must honor accepted
          commitments or promptly communicate a necessary change. Final booking
          prices must be accurate and approved by the customer through Stripe
          Checkout before paid work is treated as an Auxilium transaction.
        </p>
        <p>
          Material scope, scheduling, and resolution communication should remain
          in Auxilium messages. Providers may not use the platform to solicit
          off-platform payment for an Auxilium-originated booking in order to
          avoid platform fees or protections.
        </p>
      </PolicySection>

      <PolicySection title="5. Payments, fees, taxes, and reversals">
        <p>
          The provider authorizes Stripe and Auxilium to create and manage a
          connected payout account, route customer payments, and deduct the
          disclosed Auxilium platform fee, currently 5% of the final booking
          price. Stripe may separately apply processing, payout, reserve, risk,
          or currency fees under the provider’s Stripe agreement.
        </p>
        <p>
          Providers authorize proportional reversal of their transfer and the
          Auxilium fee when an approved refund is issued. Providers remain
          responsible for negative balances, chargebacks, dispute fees, taxes,
          reporting, and other obligations associated with their services and
          connected account.
        </p>
      </PolicySection>

      <PolicySection title="6. Resolution cooperation">
        <p>
          Providers must respond honestly and promptly to customer resolution
          requests, safety reports, and information requests. Auxilium may
          review platform records, issue a full or partial refund, restrict
          payouts where permitted, or suspend the account while a material issue
          is reviewed. Stripe and card-network decisions remain independently
          binding where applicable.
        </p>
      </PolicySection>

      <PolicySection title="7. Suspension and termination">
        <p>
          Auxilium may return an application for changes, reject it, remove a
          listing, restrict bookings, or suspend or terminate access for policy
          violations, expired or false credentials, unsafe behavior, repeated
          complaints, fraud risk, legal requirements, or noncooperation.
          Outstanding bookings, refunds, disputes, records, and payment duties
          survive account closure where necessary.
        </p>
      </PolicySection>

      <PolicySection title="8. Other terms">
        <p>
          The <Link href="/terms">Terms of Service</Link>,{" "}
          <Link href="/privacy">Privacy Policy</Link>, and{" "}
          <Link href="/cancellation-refunds">Cancellation, Refund, and Dispute
          Policy</Link> also apply. If this agreement conflicts with the general
          terms on a provider-specific issue, this agreement controls.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
