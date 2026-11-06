import type { Metadata } from "next";
import Link from "next/link";
import { ProviderCredentialReviewForm } from "@/components/admin/provider-credential-review-form";
import { ProviderReviewForm } from "@/components/admin/provider-review-form";
import { ProviderServiceCredentialReviewForm } from "@/components/admin/provider-service-credential-review-form";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getAdminProviderApplications,
  hasCurrentInsuranceCredential,
} from "@/lib/providers/data";
import {
  formatPrice,
  labelFromSnakeCase,
  weekdays,
} from "@/lib/providers/presentation";

export const metadata: Metadata = {
  title: "Provider review queue",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminDashboardPage() {
  const { admin, applications, serviceReviewAvailable } = await getAdminProviderApplications();
  const submittedCount = applications.filter(
    (application) => application.details.submittedAt,
  ).length;

  return (
    <DashboardShell
      profile={admin}
      eyebrow="Admin dashboard"
      title="Provider review queue"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-sm text-muted">Provider accounts</p>
          <p className="mt-2 text-3xl font-semibold text-brand-dark">
            {applications.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-sm text-muted">Submitted for review</p>
          <p className="mt-2 text-3xl font-semibold text-brand-dark">
            {submittedCount}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-sm text-muted">Approved</p>
          <p className="mt-2 text-3xl font-semibold text-brand-dark">
            {
              applications.filter(
                (application) =>
                  application.profile.providerStatus === "approved",
              ).length
            }
          </p>
        </div>
      </div>

      <Link
        href="/dashboard/admin/cases"
        className="mt-5 flex items-center justify-between rounded-2xl border border-brand/25 bg-[#f2f2f2] px-5 py-4 font-semibold text-brand-dark transition hover:border-brand hover:bg-[#e4f1e9]"
      >
        <span>Open resolution center</span>
        <span aria-hidden="true">→</span>
      </Link>

      {!serviceReviewAvailable && (
        <p role="status" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950">
          Service credential reviews are temporarily unavailable. Provider approval will be available when these reviews can be checked.
        </p>
      )}

      {applications.length === 0 ? (
        <section className="mt-7 rounded-3xl border border-border bg-white p-8">
          <h2 className="text-2xl font-semibold text-brand-dark">
            No provider accounts yet
          </h2>
          <p className="mt-3 leading-7 text-muted">
            New provider registrations will appear here automatically.
          </p>
        </section>
      ) : (
        <div className="mt-7 space-y-7">
          {applications.map((application) => {
            const availableDays = application.availability.filter(
              (day) => day.isAvailable,
            );
            const canReview = Boolean(application.details.submittedAt);
            const hasApprovedCurrentInsurance =
              hasCurrentInsuranceCredential(application.credentials, true);
            const activeServices = application.services.filter((service) => service.isActive);
            const outstandingServiceReviews = activeServices.filter((service) => !service.credentialReviewCurrent).length;
            const approvalRequirements: string[] = [];
            if (!application.completion.isComplete) approvalRequirements.push("Confirm all required application sections are complete.");
            if (!hasApprovedCurrentInsurance) approvalRequirements.push("Approve a current insurance document in Private credentials.");
            if (!serviceReviewAvailable) approvalRequirements.push("Restore access to service credential reviews.");
            else if (outstandingServiceReviews) approvalRequirements.push("Complete the credential review for each active service.");
            const canApprove = canReview && approvalRequirements.length === 0;
            const credentialsSectionId = `private-credentials-${application.profile.id}`;
            const credentialOptions = application.credentials
              .filter((credential) => credential.eligibleForServiceReview)
              .map(({ id, credentialType, title, issuer, expiresOn, documentUrl }) => ({ id, credentialType, title, issuer, expiresOn, documentUrl }));

            return (
              <article
                key={application.profile.id}
                className="overflow-hidden rounded-3xl border border-border bg-white"
              >
                <header className="border-b border-border bg-[#f7f7f7] p-6 sm:p-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-semibold text-brand-dark">
                          {application.details.businessName ||
                            application.profile.fullName}
                        </h2>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold capitalize text-brand-dark ring-1 ring-border">
                          {labelFromSnakeCase(
                            application.profile.providerStatus,
                          )}
                        </span>
                        {!application.details.submittedAt && (
                          <span className="rounded-full bg-[#f2f1eb] px-3 py-1 text-xs font-bold text-muted">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-muted">
                        {application.profile.fullName} · {application.profile.email}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Joined {formatDate(application.profile.createdAt)}
                        {application.details.submittedAt
                          ? ` · Submitted ${formatDate(application.details.submittedAt)}`
                          : ""}
                      </p>
                      {application.profile.providerStatus === "approved" &&
                        !hasApprovedCurrentInsurance && (
                          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-950">
                            Existing approval needs a manual current-insurance
                            audit before this provider takes new customer work.
                          </p>
                        )}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-3xl font-semibold text-brand-dark">
                        {application.completion.percentage}%
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        complete
                      </p>
                    </div>
                  </div>
                </header>

                <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-8">
                    <section>
                      <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
                        Introduction
                      </h3>
                      <p className="mt-3 text-xl font-semibold text-brand-dark">
                        {application.details.headline || "No headline yet"}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap leading-7 text-muted">
                        {application.details.bio || "No introduction yet."}
                      </p>
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div className="rounded-xl bg-[#f7f7f7] p-4">
                          <dt className="font-semibold text-muted">Service area</dt>
                          <dd className="mt-1 text-foreground">
                            {application.details.serviceArea || "Not provided"}
                            {application.details.travelRadiusMiles !== null
                              ? ` · ${application.details.travelRadiusMiles} mile radius`
                              : ""}
                          </dd>
                        </div>
                        <div className="rounded-xl bg-[#f7f7f7] p-4">
                          <dt className="font-semibold text-muted">Experience</dt>
                          <dd className="mt-1 text-foreground">
                            {application.details.yearsExperience === null
                              ? "Not provided"
                              : `${application.details.yearsExperience} years`}
                          </dd>
                        </div>
                      </dl>
                    </section>

                    <section>
                      <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
                        Services
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        Review each active service for the provider’s stated service area before approving the application.
                      </p>
                      <div className="mt-3 space-y-3">
                        {application.services.length === 0 ? (
                          <p className="text-sm text-muted">No services added.</p>
                        ) : (
                          application.services.map((service) => (
                            <div
                              key={service.id}
                              className="rounded-2xl border border-border p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-brand-dark">
                                    {service.name}
                                  </p>
                                  {service.description && (
                                    <p className="mt-1 text-sm leading-6 text-muted">
                                      {service.description}
                                    </p>
                                  )}
                                </div>
                                <span className="rounded-full bg-[#f2f2f2] px-3 py-1 text-xs font-bold text-brand-dark">
                                  {formatPrice(
                                    service.pricingType,
                                    service.priceCents,
                                  )}
                                </span>
                              </div>
                              {service.isActive ? (
                                <>
                                  {serviceReviewAvailable ? (
                                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${service.credentialReviewCurrent ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>
                                        {service.credentialReviewCurrent ? "Credential review current" : service.credentialReview ? "Re-review needed" : "Credential review required"}
                                      </span>
                                      {service.credentialReview && <span className="text-xs text-muted">Last reviewed {formatDate(service.credentialReview.reviewedAt)}</span>}
                                    </div>
                                  ) : null}
                                  {serviceReviewAvailable && service.credentialReview && !service.credentialReviewCurrent && <p className="mt-2 text-xs leading-5 text-muted">Check for expired documents or a change in document approval. Select current documents and save the review again.</p>}
                                  {serviceReviewAvailable && <ProviderServiceCredentialReviewForm
                                    key={`${service.id}:${service.updatedAt}:${application.details.updatedAt}:${service.credentialReviewCurrent}`}
                                    serviceId={service.id}
                                    serviceUpdatedAt={service.updatedAt}
                                    profileUpdatedAt={application.details.updatedAt}
                                    credentials={credentialOptions}
                                    currentReview={service.credentialReviewCurrent ? service.credentialReview : null}
                                    credentialsSectionId={credentialsSectionId}
                                  />}
                                </>
                              ) : <p className="mt-3 text-xs text-muted">Inactive service</p>}
                            </div>
                          ))
                        )}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
                        Photos
                      </h3>
                      {application.photos.length === 0 ? (
                        <p className="mt-3 text-sm text-muted">No photos added.</p>
                      ) : (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {application.photos.map((photo) => (
                            <div
                              key={photo.id}
                              className="overflow-hidden rounded-2xl border border-border"
                            >
                              <div
                                className="aspect-[4/3] bg-[#efefef] bg-cover bg-center"
                                style={{
                                  backgroundImage: `url(${photo.publicUrl})`,
                                }}
                                role="img"
                                aria-label={photo.caption || "Provider photo"}
                              />
                              <p className="p-3 text-xs text-muted">
                                {photo.caption || "Provider photo"}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>

                  <aside className="space-y-7">
                    <section id={credentialsSectionId} className="scroll-mt-6">
                      <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
                        Private credentials
                      </h3>
                      <div className="mt-3 space-y-3">
                        {application.credentials.length === 0 ? (
                          <p className="text-sm text-muted">
                            No credentials uploaded.
                          </p>
                        ) : (
                          application.credentials.map((credential) => (
                            <div
                              key={credential.id}
                              className="rounded-2xl border border-border p-4"
                            >
                              <p className="font-semibold text-brand-dark">
                                {credential.title}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-muted">
                                {labelFromSnakeCase(credential.credentialType)}
                                {credential.issuer
                                  ? ` · ${credential.issuer}`
                                  : ""}
                                {credential.expiresOn
                                  ? ` · Expires ${credential.expiresOn}`
                                  : ""}
                              </p>
                              <p className="mt-2 text-xs font-semibold capitalize text-foreground">
                                Review status: {credential.reviewStatus}
                              </p>
                              {credential.credentialNumber && (
                                <p className="mt-2 text-xs text-muted">
                                  Number: {credential.credentialNumber}
                                </p>
                              )}
                              {credential.documentUrl ? (
                                <a
                                  href={credential.documentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 inline-flex text-sm font-semibold text-brand underline underline-offset-4"
                                >
                                  View private document
                                </a>
                              ) : (
                                <p className="mt-3 text-xs text-red-700">
                                  Document link unavailable.
                                </p>
                              )}
                              <ProviderCredentialReviewForm
                                credentialId={credential.id}
                                reviewStatus={credential.reviewStatus}
                                reviewNotes={credential.reviewNotes}
                              />
                            </div>
                          ))
                        )}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
                        Availability
                      </h3>
                      <div className="mt-3 rounded-2xl border border-border p-4">
                        {availableDays.length === 0 ? (
                          <p className="text-sm text-muted">
                            No available days selected.
                          </p>
                        ) : (
                          <ul className="space-y-2 text-sm">
                            {availableDays.map((day) => (
                              <li
                                key={day.weekday}
                                className="flex justify-between gap-4"
                              >
                                <span className="font-semibold text-brand-dark">
                                  {weekdays[day.weekday]}
                                </span>
                                <span className="text-muted">
                                  {day.startTime}–{day.endTime}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>

                    {application.reviewEvents.length > 0 && (
                      <section>
                        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
                          Review history
                        </h3>
                        <div className="mt-3 space-y-3">
                          {application.reviewEvents.map((event) => (
                            <div
                              key={event.id}
                              className="rounded-2xl border border-border p-4 text-sm"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold capitalize text-brand-dark">
                                  {event.decision}
                                </p>
                                <p className="text-xs text-muted">
                                  {formatDate(event.createdAt)}
                                </p>
                              </div>
                              {event.notes && (
                                <p className="mt-2 leading-6 text-muted">
                                  {event.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    <section>
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-brand">
                        Admin decision
                      </h3>
                      <ProviderReviewForm
                        providerId={application.profile.id}
                        providerStatus={application.profile.providerStatus}
                        canReview={canReview}
                        canApprove={canApprove}
                        approvalRequirements={approvalRequirements}
                      />
                    </section>
                  </aside>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
