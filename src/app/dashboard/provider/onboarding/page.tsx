import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProviderAvailabilityForm } from "@/components/provider/provider-availability-form";
import { ProviderProfileForm } from "@/components/provider/provider-profile-form";
import { ProviderServiceForm } from "@/components/provider/provider-service-form";
import { ProviderSubmitCard } from "@/components/provider/provider-submit-card";
import { ProviderUploadManager } from "@/components/provider/provider-upload-manager";
import { getProviderWorkspace } from "@/lib/providers/data";

export const metadata: Metadata = {
  title: "Provider profile setup",
};

function Section({
  number,
  title,
  description,
  complete,
  children,
}: {
  number: number;
  title: string;
  description: string;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-6 rounded-3xl border border-border bg-white p-6 sm:p-8">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-accent">
            Step {number}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-brand-dark">{title}</h2>
          <p className="mt-2 max-w-2xl leading-7 text-muted">{description}</p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${
            complete
              ? "bg-[#e7f4ec] text-brand-dark"
              : "bg-[#f2f1eb] text-muted"
          }`}
        >
          {complete ? "Complete" : "Needs attention"}
        </span>
      </div>
      {children}
    </section>
  );
}

export default async function ProviderOnboardingPage() {
  const workspace = await getProviderWorkspace();
  const {
    profile,
    details,
    services,
    photos,
    credentials,
    availability,
    completion,
  } = workspace;

  return (
    <DashboardShell
      profile={profile}
      eyebrow="Provider onboarding"
      title="Build a profile customers can trust."
    >
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl leading-7 text-muted">
          Your draft saves section by section. Credential documents stay private
          and can only be viewed by you and authorized Auxilium administrators.
        </p>
        <Link
          href="/dashboard/provider"
          className="text-sm font-semibold text-brand underline decoration-brand/30 underline-offset-4"
        >
          Return to overview
        </Link>
      </div>

      <div className="space-y-7">
        <Section
          number={1}
          title="Professional introduction"
          description="Explain your experience, service area, and what customers can expect."
          complete={completion.introduction}
        >
          <ProviderProfileForm details={details} />
        </Section>

        <Section
          number={2}
          title="Services and pricing"
          description="List each service separately so customers understand what they can book."
          complete={completion.services}
        >
          <ProviderServiceForm services={services} />
        </Section>

        <Section
          number={3}
          title="Photos and credentials"
          description="Add at least one photo and one private verification document."
          complete={completion.photos && completion.credentials}
        >
          <ProviderUploadManager
            providerId={profile.id}
            photos={photos}
            credentials={credentials.map((credential) => ({
              id: credential.id,
              credentialType: credential.credentialType,
              title: credential.title,
              issuer: credential.issuer,
              expiresOn: credential.expiresOn,
              reviewStatus: credential.reviewStatus,
              reviewNotes: credential.reviewNotes,
            }))}
          />
        </Section>

        <Section
          number={4}
          title="Weekly availability"
          description="Select the days you normally work and the hours customers can request."
          complete={completion.availability}
        >
          <ProviderAvailabilityForm availability={availability} />
        </Section>

        <ProviderSubmitCard
          completion={completion}
          submittedAt={details.submittedAt}
        />
      </div>
    </DashboardShell>
  );
}
