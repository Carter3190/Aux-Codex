"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { LEGAL_AGREEMENTS, type LegalAgreementKey } from "./agreements";

const documentKeySchema = z.enum([
  "terms",
  "privacy",
  "provider_agreement",
  "provider_standards",
]);
const reviewConfirmationSchema = z.literal("accepted");
const documentVersionSchema = z.string().trim().min(1).max(40);
const contentSha256Schema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{64}$/);

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

function legalDocumentPath(documentKey: LegalAgreementKey) {
  return Object.values(LEGAL_AGREEMENTS).find(
    (agreement) => agreement.key === documentKey,
  )?.href;
}

function reviewErrorPath(
  documentKey: LegalAgreementKey,
  error: "confirmation" | "save" | "stale",
  nextPath: string,
  documentVersion?: string,
  contentSha256?: string,
) {
  const documentPath = legalDocumentPath(documentKey) ?? "/legal/accept";
  const query = new URLSearchParams({
    review: "1",
    error,
    next: nextPath,
  });
  if (documentVersion) query.set("version", documentVersion);
  if (contentSha256) query.set("hash", contentSha256);
  return `${documentPath}?${query.toString()}`;
}

export async function acceptCurrentLegalAgreements(formData: FormData) {
  const nextPath = safeReturnPath(formData.get("next"));

  await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "accept_current_account_legal_agreements",
  );

  if (error) {
    const errorCode = error.message
      .toLowerCase()
      .includes("review and confirm every current legal document")
      ? "reviews"
      : "save";
    redirect(
      `/legal/accept?error=${errorCode}&next=${encodeURIComponent(nextPath)}`,
    );
  }

  revalidatePath("/dashboard", "layout");
  redirect(nextPath);
}

export async function completeLegalDocumentReview(formData: FormData) {
  const nextPath = safeReturnPath(formData.get("next"));
  const documentKey = documentKeySchema.safeParse(formData.get("documentKey"));

  if (!documentKey.success) {
    redirect(`/legal/accept?error=review&next=${encodeURIComponent(nextPath)}`);
  }

  const documentVersion = documentVersionSchema.safeParse(
    formData.get("documentVersion"),
  );
  const contentSha256 = contentSha256Schema.safeParse(
    formData.get("contentSha256"),
  );
  if (!documentVersion.success || !contentSha256.success) {
    redirect(reviewErrorPath(documentKey.data, "stale", nextPath));
  }

  const confirmation = reviewConfirmationSchema.safeParse(
    formData.get("confirmation"),
  );
  if (!confirmation.success) {
    redirect(
      reviewErrorPath(
        documentKey.data,
        "confirmation",
        nextPath,
        documentVersion.data,
        contentSha256.data,
      ),
    );
  }

  await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "complete_current_legal_document_review",
    {
      reviewed_document_key: documentKey.data,
      reviewed_document_version: documentVersion.data,
      reviewed_content_sha256: contentSha256.data,
      review_confirmation: confirmation.data,
    },
  );

  if (error) {
    const errorCode = error.message
      .toLowerCase()
      .includes("document changed")
      ? "stale"
      : "save";
    redirect(
      reviewErrorPath(
        documentKey.data,
        errorCode,
        nextPath,
        documentVersion.data,
        contentSha256.data,
      ),
    );
  }

  revalidatePath("/legal/accept");
  redirect(`/legal/accept?next=${encodeURIComponent(nextPath)}`);
}
