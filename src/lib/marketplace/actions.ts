"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMarketplaceActionRole } from "./data";
import type { MarketplaceActionState } from "./types";

const bookingSchema = z.object({
  providerId: z.uuid("Invalid provider."),
  serviceId: z.uuid("Choose a service."),
  requestedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
  requestedTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Choose a valid start time."),
  serviceLocation: z
    .string()
    .trim()
    .min(5, "Enter the address or service location.")
    .max(300, "Use 300 characters or fewer."),
  notes: z.string().trim().max(2000, "Use 2,000 characters or fewer."),
});

const responseSchema = z.object({
  bookingId: z.uuid("Invalid booking request."),
  decision: z.enum(["accepted", "declined"]),
  notes: z.string().trim().max(1000, "Use 1,000 characters or fewer."),
});

const bookingIdSchema = z.uuid("Invalid booking request.");

function success(message: string): MarketplaceActionState {
  return { status: "success", message };
}

function failure(message: string): MarketplaceActionState {
  return { status: "error", message };
}

function databaseMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  const expected = [
    "only customer",
    "only provider",
    "not currently available",
    "choose an active service",
    "choose a date",
    "choose a time",
    "enter a service location",
    "use 2,000",
    "use 1,000",
    "20 pending requests",
    "already have an active request",
    "booking request not found",
    "only pending requests",
    "already accepted another booking",
    "booking cannot be cancelled",
  ];
  if (expected.some((part) => normalized.includes(part))) {
    return message ?? "Check the request and try again.";
  }
  if (normalized.includes("function") || normalized.includes("relation")) {
    return "The customer marketplace migration must be installed in Supabase first.";
  }
  return "We could not save that request. Please try again.";
}

export async function requestBooking(
  _previousState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const parsed = bookingSchema.safeParse({
    providerId: formData.get("providerId"),
    serviceId: formData.get("serviceId"),
    requestedDate: formData.get("requestedDate"),
    requestedTime: formData.get("requestedTime"),
    serviceLocation: formData.get("serviceLocation"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { supabase } = await requireMarketplaceActionRole("customer");
    const { error } = await supabase.rpc("request_booking", {
      requested_provider_id: parsed.data.providerId,
      requested_service_id: parsed.data.serviceId,
      requested_date: parsed.data.requestedDate,
      requested_start_time: parsed.data.requestedTime,
      requested_location: parsed.data.serviceLocation,
      requested_notes: parsed.data.notes,
    });
    if (error) return failure(databaseMessage(error.message));

    revalidatePath("/dashboard/customer", "layout");
    revalidatePath("/dashboard/provider", "layout");
    return success("Booking request sent. You can track it in your dashboard.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to send request.");
  }
}

export async function respondToBooking(
  _previousState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const parsed = responseSchema.safeParse({
    bookingId: formData.get("bookingId"),
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { supabase } = await requireMarketplaceActionRole("provider");
    const { error } = await supabase.rpc("respond_to_booking", {
      requested_booking_id: parsed.data.bookingId,
      response_decision: parsed.data.decision,
      response_notes: parsed.data.notes,
    });
    if (error) return failure(databaseMessage(error.message));

    revalidatePath("/dashboard/provider", "layout");
    revalidatePath("/dashboard/customer", "layout");
    return success(
      parsed.data.decision === "accepted"
        ? "Booking request accepted."
        : "Booking request declined.",
    );
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to respond.");
  }
}

export async function cancelBooking(
  _previousState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const bookingId = bookingIdSchema.safeParse(formData.get("bookingId"));
  if (!bookingId.success) return failure("Invalid booking request.");

  try {
    const { supabase } = await requireMarketplaceActionRole("customer");
    const { error } = await supabase.rpc("cancel_booking", {
      requested_booking_id: bookingId.data,
    });
    if (error) return failure(databaseMessage(error.message));

    revalidatePath("/dashboard/customer", "layout");
    revalidatePath("/dashboard/provider", "layout");
    return success("Booking request cancelled.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to cancel request.");
  }
}
