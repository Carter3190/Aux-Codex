import type { Metadata } from "next";
import { ProviderReviewForm } from "@/components/admin/provider-review-form";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAdminProviderApplications } from "@/lib/providers/data";
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
  const { admin, applications } = await getAdminProviderApplications();
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
            const canReview =
              application.completion.isComplete &&
              Boolean(application.details.submittedAt);

            return (
              <article
                key={application.profile.id}
                className="overflow-hidden rounded-3xl border border-border bg-white"
              >
                <header className="border-b border-border bg-[#f7f9f6] p-6 sm:p-8">
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
                        <div className="rounded-xl bg-[#f7f9f6] p-4">
                          <dt className="font-semibold text-muted">Service area</dt>
                          <dd className="mt-1 text-foreground">
                            {application.details.serviceArea || "Not provided"}
                            {application.details.travelRadiusMiles !== null
                              ? ` · ${application.details.travelRadiusMiles} mile radius`
                              : ""}
                          </dd>
                        </div>
                        <div className="rounded-xl bg-[#f7f9f6] p-4">
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
                                <span className="rounded-full bg-[#eef6f1] px-3 py-1 text-xs font-bold text-brand-dark">
                                  {formatPrice(
                                    service.pricingType,
                                    service.priceCents,
                                  )}
                                </span>
                              </div>
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
                                className="aspect-[4/3] bg-[#eef1ed] bg-cover bg-center"
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
                    <section>
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
