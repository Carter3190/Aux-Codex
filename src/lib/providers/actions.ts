"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionRole } from "./data";
import type { ProviderActionState } from "./types";

const optionalInteger = (minimum: number, maximum: number, label: string) =>
  z.preprocess(
    (value) => (value === "" || value === null ? null : Number(value)),
    z
      .number({ error: `${label} must be a number.` })
      .int(`${label} must be a whole number.`)
      .min(minimum, `${label} must be at least ${minimum}.`)
      .max(maximum, `${label} must be ${maximum} or less.`)
      .nullable(),
  );

const detailsSchema = z.object({
  businessName: z.string().trim().max(100, "Use 100 characters or fewer."),
  headline: z
    .string()
    .trim()
    .min(10, "Write at least 10 characters.")
    .max(120, "Use 120 characters or fewer."),
  bio: z
    .string()
    .trim()
    .min(80, "Write at least 80 characters so customers understand your work.")
    .max(2000, "Use 2,000 characters or fewer."),
  yearsExperience: optionalInteger(0, 80, "Years of experience"),
  serviceArea: z
    .string()
    .trim()
    .min(2, "Enter the city, county, or area you serve.")
    .max(160, "Use 160 characters or fewer."),
  travelRadiusMiles: optionalInteger(0, 250, "Travel radius"),
});

const serviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter a service name.")
    .max(80, "Use 80 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(500, "Use 500 characters or fewer."),
  pricingType: z.enum(["hourly", "fixed", "starting_at", "quote"]),
  price: z.string().trim(),
});

const uploadPathSchema = z
  .string()
  .trim()
  .min(3)
  .max(500)
  .regex(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i);

const photoSchema = z.object({
  storagePath: uploadPathSchema,
  caption: z.string().trim().max(160, "Use 160 characters or fewer."),
});

const credentialSchema = z.object({
  credentialType: z.enum([
    "license",
    "insurance",
    "certification",
    "identity",
    "background_check",
    "other",
  ]),
  title: z
    .string()
    .trim()
    .min(2, "Enter a credential title.")
    .max(120, "Use 120 characters or fewer."),
  issuer: z.string().trim().max(120, "Use 120 characters or fewer."),
  credentialNumber: z
    .string()
    .trim()
    .max(120, "Use 120 characters or fewer."),
  expiresOn: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Enter a valid expiration date.",
    ),
  documentPath: uploadPathSchema,
});

const reviewSchema = z.object({
  providerId: z.uuid("Invalid provider account."),
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
});

function databaseMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("provider_services_provider_id_name_key")) {
    return "You already added a service with that name.";
  }
  if (
    normalized.includes("complete your") ||
    normalized.includes("add at least") ||
    normalized.includes("not submitted") ||
    normalized.includes("clear review notes") ||
    normalized.includes("no longer complete")
  ) {
    return message ?? "Complete the required sections and try again.";
  }
  if (normalized.includes("relation") || normalized.includes("column")) {
    return "The provider onboarding migration must be installed in Supabase first.";
  }
  return "We could not save that change. Please try again.";
}

function success(message: string): ProviderActionState {
  return { status: "success", message };
}

function failure(message: string): ProviderActionState {
  return { status: "error", message };
}

function priceInCents(pricingType: string, price: string) {
  if (pricingType === "quote") {
    return { value: null };
  }

  const amount = Number(price);
  if (!Number.isFinite(amount) || amount < 1 || amount > 1000000) {
    return { error: "Enter a price between $1 and $1,000,000." };
  }

  return { value: Math.round(amount * 100) };
}

export async function saveProviderDetails(
  _previousState: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const parsed = detailsSchema.safeParse({
    businessName: formData.get("businessName"),
    headline: formData.get("headline"),
    bio: formData.get("bio"),
    yearsExperience: formData.get("yearsExperience"),
    serviceArea: formData.get("serviceArea"),
    travelRadiusMiles: formData.get("travelRadiusMiles"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { supabase, userId } = await requireActionRole("provider");
    const { error } = await supabase
      .from("provider_details")
      .update({
        business_name: parsed.data.businessName,
        headline: parsed.data.headline,
        bio: parsed.data.bio,
        years_experience: parsed.data.yearsExperience,
        service_area: parsed.data.serviceArea,
        travel_radius_miles: parsed.data.travelRadiusMiles,
      })
      .eq("provider_id", userId);

    if (error) return failure(databaseMessage(error.message));
    revalidatePath("/dashboard/provider", "layout");
    return success("Profile introduction saved.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to save profile.");
  }
}

export async function addProviderService(
  _previousState: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    pricingType: formData.get("pricingType"),
    price: formData.get("price"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const price = priceInCents(parsed.data.pricingType, parsed.data.price);
  if (price.error) {
    return { status: "error", fieldErrors: { price: [price.error] } };
  }

  try {
    const { supabase, userId } = await requireActionRole("provider");
    const { error } = await supabase.from("provider_services").insert({
      provider_id: userId,
      name: parsed.data.name,
      description: parsed.data.description,
      pricing_type: parsed.data.pricingType,
      price_cents: price.value,
      is_active: true,
    });

    if (error) return failure(databaseMessage(error.message));
    revalidatePath("/dashboard/provider", "layout");
    return success("Service added.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to add service.");
  }
}

export async function removeProviderService(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("serviceId"));
  if (!id.success) return;

  const { supabase, userId } = await requireActionRole("provider");
  await supabase
    .from("provider_services")
    .delete()
    .eq("id", id.data)
    .eq("provider_id", userId);
  revalidatePath("/dashboard/provider", "layout");
}

export async function saveProviderAvailability(
  _previousState: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const rows = Array.from({ length: 7 }, (_, weekday) => {
    const isAvailable = formData.get(`available_${weekday}`) === "on";
    const startTime = String(formData.get(`start_${weekday}`) ?? "");
    const endTime = String(formData.get(`end_${weekday}`) ?? "");
    return {
      weekday,
      isAvailable,
      startTime: isAvailable ? startTime : null,
      endTime: isAvailable ? endTime : null,
    };
  });

  for (const row of rows) {
    if (
      row.isAvailable &&
      (!/^\d{2}:\d{2}$/.test(row.startTime ?? "") ||
        !/^\d{2}:\d{2}$/.test(row.endTime ?? "") ||
        (row.startTime ?? "") >= (row.endTime ?? ""))
    ) {
      return failure("Each available day needs a valid start time before its end time.");
    }
  }

  try {
    const { supabase, userId } = await requireActionRole("provider");
    const { error } = await supabase.from("provider_availability").upsert(
      rows.map((row) => ({
        provider_id: userId,
        weekday: row.weekday,
        is_available: row.isAvailable,
        start_time: row.startTime,
        end_time: row.endTime,
      })),
      { onConflict: "provider_id,weekday" },
    );

    if (error) return failure(databaseMessage(error.message));
    revalidatePath("/dashboard/provider", "layout");
    return success("Availability saved.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to save availability.");
  }
}

async function storageObjectExists(
  bucket: "provider-photos" | "provider-credentials",
  path: string,
) {
  const { supabase, userId } = await requireActionRole("provider");
  if (!path.startsWith(`${userId}/`)) {
    return { supabase, userId, exists: false };
  }
  const fileName = path.slice(userId.length + 1);
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(userId, { search: fileName, limit: 10 });
  return {
    supabase,
    userId,
    exists: !error && Boolean(data?.some((file) => file.name === fileName)),
  };
}

export async function registerProviderPhoto(
  formData: FormData,
): Promise<ProviderActionState> {
  const parsed = photoSchema.safeParse({
    storagePath: formData.get("storagePath"),
    caption: formData.get("caption"),
  });
  if (!parsed.success) {
    return failure("The uploaded photo information is invalid.");
  }

  try {
    const context = await storageObjectExists(
      "provider-photos",
      parsed.data.storagePath,
    );
    if (!context.exists) return failure("The photo upload could not be verified.");

    const { error } = await context.supabase.from("provider_photos").insert({
      provider_id: context.userId,
      storage_path: parsed.data.storagePath,
      caption: parsed.data.caption,
    });
    if (error) return failure(databaseMessage(error.message));
    revalidatePath("/dashboard/provider", "layout");
    return success("Photo added.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to add photo.");
  }
}

export async function registerProviderCredential(
  formData: FormData,
): Promise<ProviderActionState> {
  const parsed = credentialSchema.safeParse({
    credentialType: formData.get("credentialType"),
    title: formData.get("title"),
    issuer: formData.get("issuer"),
    credentialNumber: formData.get("credentialNumber"),
    expiresOn: formData.get("expiresOn"),
    documentPath: formData.get("documentPath"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the credential details and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const context = await storageObjectExists(
      "provider-credentials",
      parsed.data.documentPath,
    );
    if (!context.exists) return failure("The credential upload could not be verified.");

    const { error } = await context.supabase
      .from("provider_credentials")
      .insert({
        provider_id: context.userId,
        credential_type: parsed.data.credentialType,
        title: parsed.data.title,
        issuer: parsed.data.issuer,
        credential_number: parsed.data.credentialNumber,
        expires_on: parsed.data.expiresOn || null,
        document_path: parsed.data.documentPath,
      });
    if (error) return failure(databaseMessage(error.message));
    revalidatePath("/dashboard/provider", "layout");
    return success("Credential submitted for review.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to add credential.");
  }
}

export async function removeProviderUpload(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("uploadId"));
  const kind = z.enum(["photo", "credential"]).safeParse(formData.get("kind"));
  if (!id.success || !kind.success) return;

  const { supabase, userId } = await requireActionRole("provider");
  let storagePath: string | undefined;

  if (kind.data === "photo") {
    const { data } = await supabase
      .from("provider_photos")
      .select("storage_path")
      .eq("id", id.data)
      .eq("provider_id", userId)
      .single();
    storagePath = data?.storage_path;
  } else {
    const { data } = await supabase
      .from("provider_credentials")
      .select("document_path")
      .eq("id", id.data)
      .eq("provider_id", userId)
      .single();
    storagePath = data?.document_path;
  }

  if (!storagePath) return;
  const table = kind.data === "photo" ? "provider_photos" : "provider_credentials";
  const bucket = kind.data === "photo" ? "provider-photos" : "provider-credentials";
  const { error: storageError } = await supabase.storage
    .from(bucket)
    .remove([storagePath]);
  if (storageError) return;

  await supabase
    .from(table)
    .delete()
    .eq("id", id.data)
    .eq("provider_id", userId);
  revalidatePath("/dashboard/provider", "layout");
}

export async function submitProviderApplication(
  _previousState: ProviderActionState,
  _formData: FormData,
): Promise<ProviderActionState> {
  void _previousState;
  void _formData;
  try {
    const { supabase } = await requireActionRole("provider");
    const { error } = await supabase.rpc("submit_provider_application");
    if (error) return failure(databaseMessage(error.message));
    revalidatePath("/dashboard/provider", "layout");
    revalidatePath("/dashboard/admin", "layout");
    return success("Your application was submitted for admin review.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to submit application.");
  }
}

export async function reviewProviderApplication(
  _previousState: ProviderActionState,
  formData: FormData,
): Promise<ProviderActionState> {
  const parsed = reviewSchema.safeParse({
    providerId: formData.get("providerId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (parsed.data.decision === "rejected" && parsed.data.notes.length < 10) {
    return {
      status: "error",
      fieldErrors: { notes: ["Explain what the provider needs to correct."] },
    };
  }

  try {
    const { supabase } = await requireActionRole("admin");
    const { error } = await supabase.rpc("review_provider_application", {
      reviewed_provider_id: parsed.data.providerId,
      review_decision: parsed.data.decision,
      review_notes: parsed.data.notes,
    });
    if (error) return failure(databaseMessage(error.message));
    revalidatePath("/dashboard/admin", "layout");
    revalidatePath("/dashboard/provider", "layout");
    return success(
      parsed.data.decision === "approved"
        ? "Provider approved."
        : "Provider returned with review notes.",
    );
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to review provider.");
  }
}
