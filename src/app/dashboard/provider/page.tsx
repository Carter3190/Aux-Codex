import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = {
  title: "Provider dashboard",
};

export default async function ProviderDashboardPage() {
  const profile = await requireRole("provider");
  const pending = profile.providerStatus === "pending";

  return (
    <DashboardShell
      profile={profile}
      eyebrow="Provider dashboard"
      title={pending ? "Let’s build your provider profile." : "Your work, organized."}
    >
      {pending && (
        <div className="mb-6 rounded-2xl border border-[#ead6ad] bg-[#fff8e9] px-5 py-4 text-[#76531c]">
          <p className="font-semibold">Application status: Pending</p>
          <p className="mt-1 text-sm leading-6">
            Your account is secure. Provider approval tools will be added in the
            next onboarding milestone.
          </p>
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-3">
        {[
          ["Profile", "Add services, pricing, photos, and a strong introduction."],
          ["Credentials", "Submit licenses, insurance, and identity documents."],
          ["Availability", "Set the days, hours, and service area that fit your work."],
        ].map(([title, description], index) => (
          <article key={title} className="rounded-3xl border border-border bg-white p-6">
            <span className="text-sm font-bold text-accent">0{index + 1}</span>
            <h2 className="mt-8 text-xl font-semibold text-brand-dark">{title}</h2>
            <p className="mt-3 leading-7 text-muted">{description}</p>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
