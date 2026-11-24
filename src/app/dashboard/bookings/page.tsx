import { redirect } from "next/navigation";
import { getCurrentProfile, getRoleDashboardPath } from "@/lib/auth/profile";

export default async function MyBookingsPage() {
  const profile = await getCurrentProfile();
  redirect(profile.role === "admin"
    ? getRoleDashboardPath(profile.role)
    : `/dashboard/${profile.role}/bookings`);
}
