import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireRole } from "@/lib/auth/profile";

export const metadata: Metadata = {
  title: "Admin dashboard",
};

export default async function AdminDashboardPage() {
  const profile = await requireRole("admin");

  return (
    <DashboardShell
      profile={profile}
      eyebrow="Admin dashboard"
      title="Auxilium operations"
    >
      <div className="rounded-3xl border border-border bg-white p-7">
        <h2 className="text-xl font-semibold text-brand-dark">
          Provider review controls are next
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-muted">
          This protected area will hold provider approvals, document review,
          disputes, and platform oversight. Admin access can only be assigned in
          the database—not through public registration.
        </p>
      </div>
    </DashboardShell>
  );
}
