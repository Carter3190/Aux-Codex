import { redirect } from "next/navigation";
import {
  getCurrentProfile,
  getRoleDashboardPath,
} from "@/lib/auth/profile";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  redirect(getRoleDashboardPath(profile.role));
}
