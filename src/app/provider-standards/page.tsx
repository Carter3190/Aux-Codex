import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, PolicySection } from "@/components/legal/policy-page";

export const metadata: Metadata = {
  title: "Provider standards",
  description: "Eligibility, credential, safety, and service standards for Auxilium providers.",
  alternates: { canonical: "/provider-standards" },
};

export default function ProviderStandardsPage() {
  return (
    <PolicyPage
      eyebrow="Trust & safety"
      title="Provider standards"
      summary="These standards describe the minimum expectations for providers who apply, appear in the marketplace, and serve Auxilium customers."
      updated="October 26, 2026"
    >
      <PolicySection title="Eligibility">
        <ul>
          <li>Be at least 18 and legally permitted to provide the listed services.</li>
          <li>Use an accurate legal or business identity and a reachable email address.</li>
          <li>
            If applying for a business, have authority to bind that business and
            accurately identify the business responsible for customer services.
          </li>
          <li>Disclose the actual service area, experience, pricing approach, and availability.</li>
          <li>
            Use only personnel who are legally authorized, appropriately trained,
            supervised, licensed, and insured for the work they perform.
          </li>
          <li>Do not apply while prohibited from the work by law, license action, or court order.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Credentials, licensing, and insurance">
        <p>
          Providers must hold every license, registration, permit, certification,
          and insurance policy legally required for their service and location.
          Documents must be authentic, current, legible, and belong to the
          applicant, disclosed business, or applicable Provider Personnel.
          Providers must satisfy all category-specific requirements communicated
          by Auxilium, including any required commercial general liability,
          workers’ compensation, automobile, professional liability, garage or
          garagekeepers, bond, or specialty coverage. Providers must update
          Auxilium before a required credential expires or materially changes.
        </p>
        <p>
          Auxilium may review documents, request clarification, or confirm
          information with an issuer where permitted. A profile label means only
          the specific review described as of the applicable date. Document
          review is not a guarantee of coverage, policy exclusions, scope,
          identity, work quality, safety, or future conduct. Customers should
          request current proof directly when the nature of a job warrants it.
        </p>
        <p>
          A provider may not accept or perform a booking while required
          insurance, licensing, registration, certification, or a permit is
          missing, expired, suspended, or insufficient for the service. Providers
          must promptly report any lapse, cancellation, restriction, disciplinary
          action, or material change.
        </p>
      </PolicySection>

      <PolicySection title="Approved service scope, profile, and pricing integrity">
        <ul>
          <li>Use original or properly licensed photos of representative work.</li>
          <li>Do not fabricate reviews, experience, credentials, or affiliations.</li>
          <li>Clearly explain whether pricing is fixed, hourly, starting-at, or quote-based.</li>
          <li>Set the final booking price before payment and explain material changes.</li>
          <li>
            Offer and perform only the service categories Auxilium has approved
            for the provider’s profile.
          </li>
          <li>
            Do not offer or perform healthcare, chiropractic care, medical
            diagnosis or treatment, emergency services, or another restricted
            category unless Auxilium has expressly authorized that category in
            writing.
          </li>
          <li>Do not advertise prohibited, unsafe, or unlawful services.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Professional conduct and safety">
        <ul>
          <li>Communicate respectfully and without discrimination or harassment.</li>
          <li>Use appropriate protective equipment and safe work practices.</li>
          <li>Respect the customer’s property, privacy, household members, and neighbors.</li>
          <li>Never work while impaired or ask a customer to conceal a safety incident.</li>
          <li>Stop work and communicate when site conditions make the agreed service unsafe.</li>
          <li>
            In an emergency, contact 911 or the appropriate emergency service
            first, then notify Auxilium as soon as reasonably possible.
          </li>
        </ul>
        <p>
          Providers must give Auxilium written notice no later than 24 hours
          after learning of a booking-related death, bodily injury, emergency
          response, hospitalization, material property damage, police or fire
          response, regulatory inquiry, insurance claim, demand, or threatened or
          filed legal action. Providers must preserve relevant evidence, notify
          the appropriate insurer, and cooperate with reasonable follow-up.
        </p>
      </PolicySection>

      <PolicySection title="Review and enforcement">
        <p>
          Auxilium may approve, return, reject, re-review, suspend, or remove a
          provider based on application completeness, credential status, user
          reports, booking history, payment risk, safety concerns, or legal
          requirements. The response may range from education or profile changes
          to immediate suspension where the risk warrants it. Missing or expired
          required insurance or credentials may result in the provider’s listings
          or booking access being paused until the requirement is satisfied.
        </p>
        <p>
          Providers must cooperate with reasonable review requests. Questions or
          supporting information can be submitted through the{" "}
          <Link href="/support">Support Center</Link>.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
