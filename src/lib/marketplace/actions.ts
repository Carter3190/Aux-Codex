"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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

const reviewSchema = z.object({
  bookingId: bookingIdSchema,
  rating: z.coerce
    .number()
    .int()
    .min(1, "Choose a rating from 1 to 5 stars.")
    .max(5, "Choose a rating from 1 to 5 stars."),
  body: z
    .string()
    .trim()
    .min(10, "Write at least 10 characters about your experience.")
    .max(2000, "Use 2,000 characters or fewer."),
});

const messageSchema = z.object({
  bookingId: z.uuid("Invalid conversation."),
  body: z
    .string()
    .trim()
    .min(1, "Write a message before sending.")
    .max(2000, "Use 2,000 characters or fewer."),
});

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
    "only customers and providers",
    "conversation not found",
    "conversation is closed",
    "messages must be between",
    "too many messages",
    "only accepted bookings can be marked complete",
    "future booking cannot be marked complete",
    "successfully paid booking is required",
    "provider must mark this booking complete",
    "only successfully paid bookings can be reviewed",
    "already reviewed this booking",
    "reviews must be between",
    "choose a rating from 1 to 5",
  ];
  if (expected.some((part) => normalized.includes(part))) {
    return message ?? "Check the request and try again.";
  }
  if (
    normalized.includes("booking_reviews") ||
    normalized.includes("complete_booking") ||
    normalized.includes("create_booking_review")
  ) {
    return "Install the completed-bookings and verified-reviews migration in Supabase first.";
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

export async function completeBooking(
  _previousState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const bookingId = bookingIdSchema.safeParse(formData.get("bookingId"));
  if (!bookingId.success) return failure("Invalid booking request.");

  try {
    const { supabase } = await requireMarketplaceActionRole("provider");
    const { error } = await supabase.rpc("complete_booking", {
      requested_booking_id: bookingId.data,
    });
    if (error) return failure(databaseMessage(error.message));

    revalidatePath("/dashboard/provider", "layout");
    revalidatePath("/dashboard/customer", "layout");
    return success("Service marked complete. The customer can now leave a review.");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to complete the booking.",
    );
  }
}

export async function submitBookingReview(
  _previousState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const parsed = reviewSchema.safeParse({
    bookingId: formData.get("bookingId"),
    rating: formData.get("rating"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { supabase } = await requireMarketplaceActionRole("customer");
    const { error } = await supabase.rpc("create_booking_review", {
      requested_booking_id: parsed.data.bookingId,
      review_rating: parsed.data.rating,
      review_body: parsed.data.body,
    });
    if (error) return failure(databaseMessage(error.message));

    revalidatePath("/dashboard/customer", "layout");
    revalidatePath("/dashboard/provider", "layout");
    revalidatePath("/providers", "layout");
    return success("Your verified review is now published.");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to publish the review.",
    );
  }
}

export async function sendBookingMessage(
  _previousState: MarketplaceActionState,
  formData: FormData,
): Promise<MarketplaceActionState> {
  const parsed = messageSchema.safeParse({
    bookingId: formData.get("bookingId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims();
    if (claimsError || !claimsData?.claims?.sub) {
      return failure("You must be signed in to send a message.");
    }

    const { error } = await supabase.rpc("send_booking_message", {
      requested_booking_id: parsed.data.bookingId,
      message_body: parsed.data.body,
    });
    if (error) return failure(databaseMessage(error.message));

    revalidatePath(`/dashboard/messages/${parsed.data.bookingId}`);
    revalidatePath("/dashboard/messages");
    return success("Message sent.");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to send message.");
  }
}
