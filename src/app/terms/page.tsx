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
      updated="October 26, 2026"
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

      <PolicySection title="2. Marketplace role and direct service agreement">
        <p>
          Auxilium provides technology that helps customers discover independent
          service providers, request work, communicate, pay, review completed
          bookings, and request resolution assistance. If a provider accepts a
          request, any resulting service agreement is directly between the
          customer and the identified provider. The provider, not Auxilium,
          supplies and is responsible for that service. Auxilium is not the
          service contractor and is not a party to the customer-provider service
          agreement.
        </p>
        <p>
          Auxilium does not employ, appoint, supervise, direct, train, equip, or
          control providers or their owners, employees, agents, temporary
          workers, contractors, or subcontractors. Providers independently
          control whether to accept a request and the lawful methods, personnel,
          tools, safety precautions, and professional judgment used to perform
          the service.
        </p>
        <p>
          Provider approval, credential review, profile labels, and customer
          reviews help inform marketplace decisions. A label describing a
          document or credential review means only that Auxilium reviewed the
          identified information under the stated process as of the applicable
          date. No review or label guarantees identity, licensing, insurance
          coverage, quality, safety, availability, future conduct, or fitness for
          a particular job. Customers remain responsible for deciding whether a
          provider and proposed service are appropriate.
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
          <li>
            Do not request, advertise, arrange, or perform healthcare,
            chiropractic care, medical diagnosis or treatment, emergency
            services, or another category Auxilium identifies as restricted or
            prohibited unless Auxilium has expressly authorized that category in
            writing.
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
          provider accepts it. The resulting service agreement is directly
          between the customer and the identified provider. The provider may
          then set a final booking price. Customers must review that price before
          completing Stripe Checkout. Payment is processed by Stripe under its
          own terms and privacy policy; Auxilium does not store full payment-card
          details.
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
        <p>
          Claims concerning a provider’s services, acts or omissions, personnel,
          bodily injury, death, professional error, or property damage should be
          directed to the provider and, when applicable, the provider’s insurer.
          Auxilium’s voluntary assistance with communication, records, refunds,
          safety review, or account restrictions is administrative marketplace
          assistance. It is not an admission of liability and does not make
          Auxilium the service provider, insurer, claims adjuster, or guarantor
          of a provider’s obligations.
        </p>
      </PolicySection>

      <PolicySection title="6. Provider-specific obligations">
        <p>
          Providers also agree to the <Link href="/provider-agreement">Provider
          Agreement</Link> and <Link href="/provider-standards">Provider
          Standards</Link>. Providers are independent businesses, not employees,
          agents, partners, or franchisees of Auxilium, and are responsible for
          their services and results; the acts and omissions of all personnel
          they use; and their supervision, tools, methods, safety, permits,
          taxes, insurance, and legal compliance.
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
          provider’s work. Auxilium does not assume responsibility for a
          provider’s services, service results, acts or omissions, personnel,
          professional judgment, bodily injury, death, or property damage.
          Auxilium is not responsible for indirect, incidental, special,
          exemplary, or consequential damages, or lost profits, revenues, data,
          or goodwill arising from use of the platform.
        </p>
        <p>
          Where liability cannot be excluded, it is limited to the maximum
          extent permitted by applicable law. Some jurisdictions do not allow
          certain warranty exclusions or liability limits, so parts of this
          section may not apply to you. Nothing in these terms excludes or limits
          responsibility for Auxilium’s own conduct to the extent that applicable
          law does not permit that responsibility to be excluded or limited.
        </p>
        <p>
          To the fullest extent permitted by law, Auxilium’s total aggregate
          liability to you for all claims arising out of or relating to the
          platform or these terms will not exceed the greater of (a) $100 or (b)
          the platform fees Auxilium actually retained from you during the 12
          months immediately before the event giving rise to the claim. This
          limit applies regardless of the legal theory asserted. It does not
          limit payment obligations owed to a provider, a provider’s
          responsibilities under the Provider Agreement, or liability that
          applicable law does not permit to be limited.
        </p>
      </PolicySection>

      <PolicySection title="9. Changes, termination, governing law, and contact">
        <p>
          You may stop using Auxilium at any time, subject to outstanding
          bookings, payments, refunds, disputes, and lawful record-retention
          obligations. We may update these terms prospectively and will post a
          new effective date when we do. Material changes may require renewed
          acceptance.
        </p>
        <p>
          Provisions concerning the marketplace relationship, payments, refunds,
          disputes, service-related claims, content rights, disclaimers, limits,
          and obligations that by their nature should continue will survive
          account closure or termination.
        </p>
        <p>
          Questions or notices can be submitted through the{" "}
          <Link href="/support">Auxilium Support Center</Link>. These terms and
          related non-contractual claims are governed by Michigan law, without
          regard to conflict-of-law principles. Any mandatory consumer
          protections or other rights that cannot lawfully be waived remain
          unaffected.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
