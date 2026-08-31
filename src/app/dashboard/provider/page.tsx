import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BookingCard } from "@/components/marketplace/booking-card";
import { getProviderBookings } from "@/lib/marketplace/data";
import { getProviderWorkspace } from "@/lib/providers/data";
import { labelFromSnakeCase } from "@/lib/providers/presentation";

export const metadata: Metadata = {
  title: "Provider dashboard",
};

const checklist = [
  ["introduction", "Introduction", "Tell customers who you are and where you work."],
  ["services", "Services and pricing", "Add at least one service customers can request."],
  ["photos", "Profile photos", "Show a headshot or examples of completed work."],
  ["credentials", "Credentials", "Upload a license, insurance, or other verification."],
  ["availability", "Availability", "Choose at least one day and time range."],
] as const;

function statusCopy(status: string, submittedAt: string | null) {
  if (status === "approved") {
    return {
      title: "Your provider profile is approved",
      description:
        "Your profile is live in the marketplace. New customer booking requests appear below.",
      tone: "border-[#b9d8c9] bg-[#eef8f2] text-brand-dark",
    };
  }
  if (status === "rejected") {
    return {
      title: "Your application needs changes",
      description:
        "Read the latest review note, update your profile, and submit it again.",
      tone: "border-red-200 bg-red-50 text-red-900",
    };
  }
  if (status === "suspended") {
    return {
      title: "Your provider account is suspended",
      description: "Contact Auxilium support before making further changes.",
      tone: "border-red-200 bg-red-50 text-red-900",
    };
  }
  if (submittedAt) {
    return {
      title: "Your application is under review",
      description:
        "Auxilium can now review your profile and private credential documents.",
      tone: "border-[#ead6ad] bg-[#fff8e9] text-[#76531c]",
    };
  }
  return {
    title: "Finish your provider application",
    description:
      "Complete all five sections, then send the profile to Auxilium for review.",
    tone: "border-border bg-white text-brand-dark",
  };
}

export default async function ProviderDashboardPage() {
  const [workspace, bookings] = await Promise.all([
    getProviderWorkspace(),
    getProviderBookings(),
  ]);
  const { profile, details, completion, reviewEvents } = workspace;
  const status = statusCopy(profile.providerStatus, details.submittedAt);
  const latestReview = reviewEvents[0];

  return (
    <DashboardShell
      profile={profile}
      eyebrow="Provider dashboard"
      title={
        profile.providerStatus === "approved"
          ? "Your provider profile"
          : "Let’s build your provider profile."
      }
    >
      <section className={`rounded-3xl border p-6 sm:p-7 ${status.tone}`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.15em]">
              Status: {labelFromSnakeCase(profile.providerStatus)}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{status.title}</h2>
            <p className="mt-2 max-w-2xl leading-7 opacity-80">
              {status.description}
            </p>
          </div>
          <Link
            href="/dashboard/provider/onboarding"
            className="shrink-0 rounded-full bg-brand px-6 py-3 text-center font-semibold text-white transition hover:bg-brand-dark"
          >
            {completion.isComplete ? "Review profile" : "Continue setup"}
          </Link>
        </div>
      </section>

      {latestReview?.decision === "rejected" && latestReview.notes && (
        <section className="mt-6 rounded-2xl border border-red-200 bg-white p-5">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-red-700">
            Latest admin feedback
          </p>
          <p className="mt-2 leading-7 text-foreground">{latestReview.notes}</p>
        </section>
      )}

      <section className="mt-8 rounded-3xl border border-border bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-brand">
              Application progress
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-brand-dark">
              {completion.completedCount} of {completion.totalCount} sections complete
            </h2>
          </div>
          <p className="text-3xl font-semibold text-brand-dark">
            {completion.percentage}%
          </p>
        </div>
        <div
          className="mt-5 h-3 overflow-hidden rounded-full bg-[#e5ebe6]"
          role="progressbar"
          aria-valuenow={completion.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Provider application completion"
        >
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${completion.percentage}%` }}
          />
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {checklist.map(([key, title, description], index) => {
            const complete = completion[key];
            return (
              <article
                key={key}
                className={`rounded-2xl border p-5 ${
                  complete
                    ? "border-[#b9d8c9] bg-[#f4faf6]"
                    : "border-border bg-[#fafbf9]"
                }`}
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    complete
                      ? "bg-brand text-white"
                      : "bg-[#ecefe9] text-muted"
                  }`}
                  aria-hidden="true"
                >
                  {complete ? "✓" : index + 1}
                </span>
                <h3 className="mt-5 font-semibold text-brand-dark">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-brand">
              Customer requests
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-brand-dark">
              {bookings.filter((booking) => booking.status === "pending").length} pending
            </h2>
          </div>
          {profile.providerStatus === "approved" && (
            <Link
              href={`/providers/${profile.id}`}
              className="text-sm font-semibold text-brand hover:text-brand-dark"
            >
              View public profile →
            </Link>
          )}
        </div>

        {bookings.length > 0 ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} perspective="provider" />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed border-border bg-white p-8 text-center">
            <h3 className="text-xl font-semibold text-brand-dark">No booking requests yet</h3>
            <p className="mt-2 text-muted">
              New customer requests will appear here as soon as they are sent.
            </p>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
