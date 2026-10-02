import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, PolicySection } from "@/components/legal/policy-page";
import { legalVersion } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms governing use of the Auxilium local-service marketplace.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Legal"
      title="Terms of service"
      summary="These terms govern customer, provider, and visitor use of Auxilium’s marketplace, booking, communication, payment, and resolution services."
      updated="September 21, 2026"
    >
      <PolicySection title="1. Agreement and eligibility">
        <p>
          By creating an account, accessing Auxilium, or using a marketplace
          service, you agree to these Terms of Service and acknowledge our{" "}
          <Link href="/privacy">Privacy Policy</Link>. You must be at least 18
          years old and legally able to enter a binding agreement.
        </p>
        <p>
          These terms are versioned as <strong>{legalVersion}</strong>. If you
          use Auxilium on behalf of a business, you represent that you have
          authority to bind that business.
        </p>
      </PolicySection>

      <PolicySection title="2. What Auxilium provides">
        <p>
          Auxilium provides technology that helps customers discover independent
          service providers, request work, communicate, pay, review completed
          bookings, and request resolution assistance. Auxilium is not the
          provider of the services listed in the marketplace and is not a party
          to the service agreement between a customer and provider.
        </p>
        <p>
          Provider approval, credential review, profile labels, and customer
          reviews help inform marketplace decisions, but they are not a guarantee
          of identity, licensing, insurance, quality, safety, availability, or
          fitness for a particular job. Customers remain responsible for deciding
          whether a provider and proposed service are appropriate.
        </p>
      </PolicySection>

      <PolicySection title="3. Accounts and acceptable use">
        <ul>
          <li>Provide accurate, current information and keep it updated.</li>
          <li>Protect account credentials and promptly report suspected misuse.</li>
          <li>Use the platform only for lawful local-service activity.</li>
          <li>
            Do not harass, discriminate, threaten, defraud, impersonate, scrape,
            probe, disrupt, or attempt to bypass platform security or fees.
          </li>
          <li>
            Do not upload malicious code, unlawful material, or content that
            violates another person’s privacy or intellectual-property rights.
          </li>
        </ul>
        <p>
          We may restrict or suspend access when reasonably necessary to protect
          users, investigate misconduct, comply with law, or preserve platform
          integrity.
        </p>
      </PolicySection>

      <PolicySection title="4. Bookings, pricing, and payment">
        <p>
          A booking request is not a confirmed service agreement until the
          provider accepts it. The provider may then set a final booking price.
          Customers must review that price before completing Stripe Checkout.
          Payment is processed by Stripe under its own terms and privacy policy;
          Auxilium does not store full payment-card details.
        </p>
        <p>
          Providers authorize Stripe to process customer payments directly on
          the provider’s connected merchant account and authorize Auxilium to
          collect the disclosed platform fee, currently 5% of the booking price.
          Stripe processing, payout, refund, reserve, and dispute rules may also
          apply.
        </p>
      </PolicySection>

      <PolicySection title="5. Cancellations, refunds, and disputes">
        <p>
          The <Link href="/cancellation-refunds">Cancellation, Refund, and
          Dispute Policy</Link> is part of these terms. Customers and providers
          should keep material booking communication inside Auxilium so the
          record can be reviewed if a problem arises.
        </p>
        <p>
          Auxilium may review participant statements and platform records and may
          approve, partially approve, or deny a requested refund. Card-network
          disputes are decided under Stripe and card-network rules, not solely by
          Auxilium.
        </p>
      </PolicySection>

      <PolicySection title="6. Provider-specific obligations">
        <p>
          Providers also agree to the <Link href="/provider-agreement">Provider
          Agreement</Link> and <Link href="/provider-standards">Provider
          Standards</Link>. Providers are independent businesses, not employees,
          agents, partners, or franchisees of Auxilium, and are responsible for
          their services, personnel, tools, permits, taxes, insurance, and legal
          compliance.
        </p>
      </PolicySection>

      <PolicySection title="7. Content, feedback, and reviews">
        <p>
          You retain ownership of content you submit. You give Auxilium a
          worldwide, non-exclusive, royalty-free license to host, reproduce,
          format, and display that content as needed to operate, secure, promote,
          and improve the marketplace. Public provider profiles and verified
          booking reviews may remain visible until removed under applicable law
          or platform policy.
        </p>
        <p>
          Reviews must reflect a genuine completed booking. Auxilium may remove
          content that is fraudulent, irrelevant, abusive, unlawful, or exposes
          sensitive personal information.
        </p>
      </PolicySection>

      <PolicySection title="8. Disclaimers and limits">
        <p>
          To the fullest extent permitted by law, Auxilium is provided “as is”
          and “as available.” We do not warrant uninterrupted access or any
          provider’s work. Auxilium is not responsible for indirect, incidental,
          special, exemplary, or consequential damages, or lost profits,
          revenues, data, or goodwill arising from use of the platform.
        </p>
        <p>
          Where liability cannot be excluded, it is limited to the maximum
          extent permitted by applicable law. Some jurisdictions do not allow
          certain warranty exclusions or liability limits, so parts of this
          section may not apply to you.
        </p>
      </PolicySection>

      <PolicySection title="9. Changes, termination, and contact">
        <p>
          You may stop using Auxilium at any time, subject to outstanding
          bookings, payments, refunds, disputes, and lawful record-retention
          obligations. We may update these terms prospectively and will post a
          new effective date when we do. Material changes may require renewed
          acceptance.
        </p>
        <p>
          Questions or notices can be submitted through the{" "}
          <Link href="/support">Auxilium Support Center</Link>. These terms are
          governed by applicable law; any mandatory consumer protections remain
          unaffected.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
