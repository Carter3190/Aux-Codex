"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

const acceptanceSchema = z.literal("accepted");

const providerPathPattern =
  /^\/providers\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function safeReturnPath(value: FormDataEntryValue | null) {
  if (
    typeof value !== "string" ||
    value.length > 1000 ||
    value.startsWith("//")
  ) {
    return "/dashboard";
  }

  const isDashboardPath =
    value === "/dashboard" ||
    value.startsWith("/dashboard/") ||
    value.startsWith("/dashboard?");

  return isDashboardPath || providerPathPattern.test(value)
    ? value
    : "/dashboard";
}

export async function acceptCurrentLegalAgreements(formData: FormData) {
  const confirmation = acceptanceSchema.safeParse(
    formData.get("confirmation"),
  );
  const nextPath = safeReturnPath(formData.get("next"));

  if (!confirmation.success) {
    redirect(
      `/legal/accept?error=confirmation&next=${encodeURIComponent(nextPath)}`,
    );
  }

  await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "accept_current_account_legal_agreements",
  );

  if (error) {
    redirect(`/legal/accept?error=save&next=${encodeURIComponent(nextPath)}`);
  }

  revalidatePath("/dashboard", "layout");
  redirect(nextPath);
}
