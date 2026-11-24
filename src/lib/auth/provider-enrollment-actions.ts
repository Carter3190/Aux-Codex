"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "./profile";
import { createClient } from "@/lib/supabase/server";

export type ProviderEnrollmentState = { message?: string };

export async function startProviderApplication(
  _previous: ProviderEnrollmentState,
): Promise<ProviderEnrollmentState> {
  void _previous;
  const profile = await getCurrentProfile();
  if (profile.role === "admin") return { message: "Use a customer account to start a provider application." };
  if (profile.role !== "provider") {
    const supabase = await createClient();
    const { error } = await supabase.rpc("start_provider_application");
    if (error) return { message: "We couldn’t start your application. Please try again or contact support." };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard/provider/onboarding");
}
