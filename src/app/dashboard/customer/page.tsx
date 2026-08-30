import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = {
  title: "Customer dashboard",
};

const actions = [
  ["Find a provider", "Provider search will appear here in the next milestone."],
  ["Your requests", "Track new and active booking requests in one place."],
  ["Messages", "Keep every provider conversation connected to the work."],
];

export default async function CustomerDashboardPage() {
  const profile = await requireRole("customer");

  return (
    <DashboardShell
      profile={profile}
      eyebrow="Customer dashboard"
      title={`Welcome, ${profile.fullName.split(" ")[0]}.`}
    >
      <div className="grid gap-5 md:grid-cols-3">
        {actions.map(([title, description], index) => (
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
