import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import { ProviderAvailabilityForm } from "@/components/provider/provider-availability-form";
import { ProviderProfileForm } from "@/components/provider/provider-profile-form";
import { ProviderServiceForm } from "@/components/provider/provider-service-form";
import { ProviderSubmitCard } from "@/components/provider/provider-submit-card";
import { ProviderUploadManager } from "@/components/provider/provider-upload-manager";
import styles from "@/components/provider/provider-profile-workspace.module.css";
import { hasCurrentInsuranceCredential } from "@/lib/providers/data";
import type { ProviderWorkspace } from "@/lib/providers/types";

const sections = [
  ["introduction", "Introduction", "Your business details, experience, and service area."],
  ["services", "Services & pricing", "The services and prices customers can request."],
  ["photos", "Profile photos", "Your headshot and examples of completed work."],
  ["credentials", "Insurance & credentials", "Your private documents and their review status."],
  ["availability", "Availability", "Your available days and time ranges."],
] as const;

export function ProviderProfileWorkspace({ workspace, section }: {
  workspace: ProviderWorkspace;
  section?: string;
}) {
  const { profile, details, services, photos, credentials, availability, completion } = workspace;
  const selected = sections.find(([key]) => key === section);
  const reviewing = section === "review";
  const currentInsurance = hasCurrentInsuranceCredential(credentials, profile.providerStatus === "approved");
  const progress = `${completion.completedCount} of ${completion.totalCount} sections complete`;
  const status = profile.providerStatus === "approved" ? "Application approved"
    : profile.providerStatus === "rejected" ? "Application needs changes"
    : profile.providerStatus === "suspended" ? "Account suspended"
    : details.submittedAt ? "Application under review" : "Finish your provider profile";
  const statusDescription = profile.providerStatus === "suspended" ? "Contact Auxilium support before making further changes."
    : profile.providerStatus === "approved" ? "Manage your public profile and account information below."
    : profile.providerStatus === "rejected" ? "Review the feedback, update your profile, and submit it again."
    : details.submittedAt ? "Your submitted application is awaiting review. You can check its details in Application review."
    : "Your draft saves section by section. Complete the required information, then submit it for review.";

  return (
    <DashboardShell profile={profile} title={selected?.[1] ?? (reviewing ? "Review your application." : "Your provider profile.")}>
      <nav className={styles.navigation} aria-label="Profile sections">
        <Link href="/dashboard/provider/onboarding" aria-current={!selected && !reviewing ? "page" : undefined}>Profile overview</Link>
        {sections.map(([key, title]) => <Link key={key} href={`/dashboard/provider/onboarding?section=${key}`} aria-current={selected?.[0] === key ? "page" : undefined}>{title}</Link>)}
        <Link href="/dashboard/provider/onboarding?section=review" aria-current={reviewing ? "page" : undefined}>Application review</Link>
      </nav>
      {!selected && !reviewing ? (
        <>
          <section className={styles.status}>
            <div><h2>{status}</h2><p>{statusDescription}</p></div>
            <Link className={styles.badge} href="/dashboard/provider/onboarding?section=review">{profile.providerStatus === "approved" ? "View application" : progress}</Link>
          </section>
          <div className={styles.grid}>
            {sections.map(([key, title, description]) => {
              const complete = key === "credentials" ? currentInsurance : completion[key];
              return <Link className={styles.tile} href={`/dashboard/provider/onboarding?section=${key}`} key={key}><h2>{title}</h2><p>{description}</p><span>{complete ? "Manage details" : "Continue setup"}<CustomerIcon name="arrow" /></span></Link>;
            })}
          </div>
        </>
      ) : reviewing ? (
        <div className={styles.review}>
          {workspace.reviewEvents[0]?.decision === "rejected" && workspace.reviewEvents[0].notes && <section className={styles.status}><div><h2>Latest review feedback</h2><p>{workspace.reviewEvents[0].notes}</p></div></section>}
          <ProviderSubmitCard completion={completion} submittedAt={details.submittedAt} providerStatus={profile.providerStatus} />
        </div>
      ) : selected ? (
        <section className={styles.panel}>
          <p className={styles.description}>{selected[2]}</p>
          {selected[0] === "introduction" && <ProviderProfileForm details={details} />}
          {selected[0] === "services" && <ProviderServiceForm services={services} />}
          {(selected[0] === "photos" || selected[0] === "credentials") && <ProviderUploadManager section={selected[0]} providerId={profile.id} photos={photos} credentials={credentials.map((credential) => ({ id: credential.id, credentialType: credential.credentialType, title: credential.title, issuer: credential.issuer, expiresOn: credential.expiresOn, reviewStatus: credential.reviewStatus, reviewNotes: credential.reviewNotes }))} />}
          {selected[0] === "availability" && <ProviderAvailabilityForm availability={availability} />}
        </section>
      ) : null}
      <p className={styles.privacy}>Credential documents stay private and can only be viewed by you and authorized Auxilium administrators.</p>
    </DashboardShell>
  );
}
