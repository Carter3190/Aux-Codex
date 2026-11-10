import type { CurrentProfile } from "@/lib/auth/profile";
import { CustomerDashboardShell } from "./customer-shell";
import { ProviderDashboardShell } from "./provider-shell";
import { AdminDashboardShell } from "./admin-shell";

type DashboardShellProps = {
  profile: CurrentProfile;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function DashboardShell(props: DashboardShellProps) {
  if (props.profile.role === "customer") return <CustomerDashboardShell {...props} />;
  if (props.profile.role === "provider") return <ProviderDashboardShell {...props} />;
  return <AdminDashboardShell {...props} />;
}
