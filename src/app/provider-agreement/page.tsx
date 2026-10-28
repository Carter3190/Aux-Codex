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
      updated="October 26, 2026"
    >
      <PolicySection title="1. Independent provider relationship and personnel">
        <p>
          Each accepted booking creates a direct service agreement between the
          provider identified in the booking and the customer. The provider, not
          Auxilium, supplies and is responsible for the service. Auxilium
          provides marketplace, communication, payment, and administrative
          technology and does not become the service contractor by facilitating
          a booking or payment.
        </p>
        <p>
          Providers operate independent businesses. Nothing in this agreement
          creates an employment, agency, partnership, joint-venture, or franchise
          relationship with Auxilium, and providers may not represent otherwise.
          Providers control whether to accept requests and the lawful price,
          methods, scheduling, staffing, supervision, tools, safety precautions,
          and professional judgment used to perform the work, subject to the
          agreed booking, applicable law, and platform standards.
        </p>
        <p>
          “Provider Personnel” means every owner, officer, employee, agent,
          temporary worker, contractor, and subcontractor a provider uses in
          connection with a booking. Providers are responsible for Provider
          Personnel and their acts and omissions as if they were the provider’s
          own. Providers must select, train, supervise, and verify that Provider
          Personnel are legally authorized, properly licensed, qualified, and
          insured for the work they perform. Providers are also responsible for
          their tools, transportation, expenses, taxes, licenses, permits,
          insurance, and service results.
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
          A profile label describing a document or credential review means only
          that Auxilium reviewed the identified information under the stated
          process as of the applicable date. It is not a warranty of identity,
          qualifications, insurance coverage, work quality, safety, or future
          conduct and does not replace a customer’s own evaluation.
        </p>
        <p>
          Providers must promptly notify Auxilium of any change to business
          ownership or legal name, loss or restriction of a license or permit,
          insurance cancellation or lapse, regulatory or disciplinary action, or
          other fact that makes profile or credential information inaccurate.
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
          <li>
            Do not offer or perform healthcare, chiropractic care, medical
            diagnosis or treatment, emergency services, or another restricted
            category unless Auxilium has expressly authorized that category in
            writing.
          </li>
        </ul>
        <p>
          The full <Link href="/provider-standards">Provider Standards</Link>
          are incorporated into this agreement.
        </p>
        <p>
          As between Auxilium and the provider, the provider is responsible for
          the performance and results of its services and for service-related
          bodily injury, death, professional error or omission, and loss of or
          damage to property caused by the provider or Provider Personnel.
        </p>
      </PolicySection>

      <PolicySection title="4. Bookings and customer communication">
        <p>
          Providers may accept or decline requests but must honor accepted
          commitments or promptly communicate a necessary change. By accepting a
          request, the provider agrees that it is entering a direct service
          agreement with the customer and has the authority, personnel,
          credentials, and insurance needed to perform it. Final booking prices
          must be accurate and approved by the customer through Stripe Checkout
          before paid work is treated as an Auxilium transaction.
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
          The provider authorizes Stripe to create and administer the provider’s
          connected merchant account and authorizes Auxilium to facilitate
          onboarding and use the platform functions permitted by Stripe to
          process customer payments directly on that account and collect the
          disclosed Auxilium platform fee, currently 5% of the final booking
          price. Stripe and the provider’s Stripe agreement govern the connected
          account. Stripe may separately apply processing, payout, reserve,
          risk, or currency fees.
        </p>
        <p>
          Providers authorize refunds of their customer charges and proportional
          refunds of the Auxilium fee when an approved refund is issued.
          Providers remain responsible for negative balances, chargebacks,
          dispute fees, taxes, reporting, and other obligations associated with
          their services and connected account.
        </p>
      </PolicySection>

      <PolicySection title="6. Insurance and proof of coverage">
        <p>
          Providers must maintain insurance that is valid where services are
          performed, covers the services and Provider Personnel using the
          marketplace, and satisfies applicable law and all category-specific
          requirements communicated by Auxilium. Depending on the service, those
          requirements may include commercial general liability, workers’
          compensation and employer’s liability, commercial or hired and
          non-owned automobile coverage, professional liability, garage or
          garagekeepers coverage, bonds, or other specialty coverage.
        </p>
        <p>
          Providers must supply current certificates, policy information, and
          endorsements upon request. When a category requirement calls for it,
          the provider must name Auxilium and its designated affiliates as
          additional insureds and provide the applicable endorsement. A
          certificate, endorsement, document review, or additional-insured status
          does not transfer the provider’s responsibility to Auxilium or
          represent that Auxilium guarantees coverage.
        </p>
        <p>
          Providers must notify Auxilium before coverage expires, is canceled,
          is not renewed, is materially reduced, or no longer covers an offered
          service, or within 24 hours after learning of the change if advance
          notice is not possible. A provider may not accept or perform a booking
          without required coverage. Auxilium may pause listings or bookings
          while coverage is missing or being reviewed.
        </p>
      </PolicySection>

      <PolicySection title="7. Incidents, claims, and resolution cooperation">
        <p>
          In an emergency, providers must contact 911 or the appropriate emergency
          service first. Providers must then give Auxilium written notice as soon
          as reasonably possible, and no later than 24 hours after learning of,
          any booking-related death, bodily injury, emergency response,
          hospitalization, material property damage, police or fire response,
          regulatory inquiry, insurance claim, demand, or threatened or filed
          legal action.
        </p>
        <p>
          Providers must respond honestly and promptly to customer resolution
          requests, safety reports, and information requests; preserve relevant
          messages, photographs, records, and physical evidence; notify the
          appropriate insurer; provide available claim and insurer contact
          information; and cooperate with reasonable investigations and claim
          handling. Providers may not make an admission or promise on Auxilium’s
          behalf or interfere with another participant’s truthful report.
        </p>
        <p>
          Auxilium may review platform records, assist with communication, issue
          a full or partial refund, restrict payouts where permitted, or suspend
          the account while a material issue is reviewed. That assistance is not
          an admission of liability and does not make Auxilium the service
          provider, insurer, or claims adjuster. Stripe and card-network decisions
          remain independently binding where applicable.
        </p>
      </PolicySection>

      <PolicySection title="8. Defense and indemnification">
        <p>
          To the fullest extent permitted by law, the provider will defend,
          indemnify, and hold harmless Auxilium, its affiliates, and their
          officers, directors, employees, and agents from third-party claims,
          demands, investigations, proceedings, liabilities, judgments, damages,
          penalties, fines, settlements, costs, and reasonable legal fees arising
          out of or related to: (a) services performed or not performed by the
          provider or Provider Personnel; (b) bodily injury, death, professional
          error or omission, or loss of or damage to property caused by the
          provider or Provider Personnel; (c) the provider’s breach of this
          agreement; (d) false or outdated application, credential, or insurance
          information; (e) a violation of law, licensing requirements, privacy,
          confidentiality, or another person’s rights; or (f) employment, wage,
          tax, benefit, or workers’ compensation obligations concerning Provider
          Personnel.
        </p>
        <p>
          This obligation does not require the provider to indemnify a protected
          party for the proportion of a claim finally determined to have been
          caused by that protected party’s own negligence, fraud, or willful
          misconduct, and it does not apply where indemnification is prohibited
          by law. The provider may not settle a claim in a way that admits fault
          by or imposes an obligation on a protected party without Auxilium’s
          written consent. Insurance requirements do not limit these obligations.
        </p>
      </PolicySection>

      <PolicySection title="9. Suspension and termination">
        <p>
          Auxilium may return an application for changes, reject it, remove a
          listing, restrict bookings, or suspend or terminate access for policy
          violations, expired or false credentials, unsafe behavior, repeated
          complaints, fraud risk, legal requirements, or noncooperation.
        </p>
      </PolicySection>

      <PolicySection title="10. Survival and other terms">
        <p>
          The <Link href="/terms">Terms of Service</Link>,{" "}
          <Link href="/privacy">Privacy Policy</Link>, and{" "}
          <Link href="/cancellation-refunds">Cancellation, Refund, and Dispute
          Policy</Link> also apply. If this agreement conflicts with the general
          terms on a provider-specific issue, this agreement controls.
        </p>
        <p>
          Obligations concerning payments, refunds, disputes, taxes, records,
          confidentiality, insurance for completed services, incident and claim
          cooperation, defense, indemnification, and any obligation that by its
          nature should continue will survive application rejection, suspension,
          account closure, or termination.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
