import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage, PolicySection } from "@/components/legal/policy-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Auxilium collects, uses, shares, and protects personal information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy"
      title="Privacy policy"
      summary="This policy explains what information Auxilium handles, why it is needed, and the choices available to marketplace users."
      updated="September 21, 2026"
    >
      <PolicySection title="1. Information we collect">
        <ul>
          <li>
            Account information, including name, email address, role, login
            records, and account preferences.
          </li>
          <li>
            Provider information, including business profile details, service
            area, availability, pricing, photos, credentials, insurance or
            license documents, and application-review history.
          </li>
          <li>
            Booking information, including requested service, date, location,
            notes, provider responses, final price, status, messages, reviews,
            and resolution records.
          </li>
          <li>
            Payment and payout references supplied by Stripe, such as payment,
            refund, dispute, and connected-account identifiers and statuses. We
            do not store complete payment-card numbers.
          </li>
          <li>
            Technical and security information, such as IP address, device and
            browser details, timestamps, error logs, and suspected abuse signals.
          </li>
        </ul>
      </PolicySection>

      <PolicySection title="2. How we use information">
        <p>We use information to:</p>
        <ul>
          <li>create and secure accounts;</li>
          <li>review providers and operate the public marketplace;</li>
          <li>process bookings, messages, payments, payouts, refunds, and disputes;</li>
          <li>send transactional and safety-related communications;</li>
          <li>prevent fraud, enforce policies, and comply with legal obligations;</li>
          <li>diagnose problems and improve reliability and user experience.</li>
        </ul>
      </PolicySection>

      <PolicySection title="3. When information is shared">
        <p>
          Booking participants receive information reasonably needed to perform
          and manage the requested service. Approved provider profile content and
          verified reviews are public. Private credentials, private messages,
          payment records, and resolution details are limited to authorized
          participants, Auxilium administrators, and service providers that need
          them to perform contracted functions.
        </p>
        <p>
          Auxilium currently relies on Supabase for authentication, database, and
          file storage; Stripe for payments and connected-provider payouts;
          Resend for transactional email; and Vercel for application hosting.
          Those companies process information under their own terms and privacy
          commitments. We may also disclose information to comply with law,
          protect safety and rights, investigate abuse, or support a business
          transaction subject to appropriate safeguards.
        </p>
        <p>Auxilium does not sell personal information for money.</p>
      </PolicySection>

      <PolicySection title="4. Retention and deletion">
        <p>
          We retain information while an account is active and as needed to
          provide services, maintain transaction and safety records, resolve
          disputes, prevent fraud, meet tax and legal obligations, and enforce
          agreements. Retention periods vary by record type and legal need.
        </p>
        <p>
          You may request account deletion or correction through the{" "}
          <Link href="/support">Support Center</Link>. Some booking, payment,
          refund, dispute, review, security, and audit records may be retained or
          de-identified when deletion is not legally or operationally permitted.
        </p>
      </PolicySection>

      <PolicySection title="5. Security and your choices">
        <p>
          We use access controls, encryption in transit, restricted private file
          storage, signed payment webhooks, and role-based database policies.
          No system is completely secure, so users should choose strong unique
          passwords and report suspected compromise promptly.
        </p>
        <p>
          You can update profile and provider information through your dashboard.
          Transactional messages are necessary to operate bookings and accounts;
          they are not marketing subscriptions. Browser settings can control
          local storage and cookies, although disabling required storage may
          prevent sign-in.
        </p>
      </PolicySection>

      <PolicySection title="6. Children and regional rights">
        <p>
          Auxilium is not intended for children under 18, and we do not knowingly
          create accounts for them. Depending on where you live, you may have
          rights to access, correct, delete, restrict, or obtain a copy of
          personal information, or to appeal a privacy-request decision. We may
          need to verify identity before completing a request.
        </p>
      </PolicySection>

      <PolicySection title="7. Changes and contact">
        <p>
          We may update this policy as the service or law changes. The date above
          identifies the current version. Submit privacy questions or requests
          through the <Link href="/support">Auxilium Support Center</Link>.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
