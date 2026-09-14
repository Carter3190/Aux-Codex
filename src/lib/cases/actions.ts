"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/profile";
import { requireMarketplaceActionRole } from "@/lib/marketplace/data";
import { isStripeServerConfigured } from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CaseActionState } from "./types";

const uuidSchema = z.uuid("Invalid resolution request.");
const moneySchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,7}(?:\.\d{1,2})?$/,
    "Enter a dollar amount with no more than two decimal places.",
  );

const openCaseSchema = z.object({
  bookingId: z.uuid("Invalid booking request."),
  category: z.enum([
    "cancellation",
    "service_issue",
    "duplicate_charge",
    "other",
  ]),
  amount: moneySchema,
  details: z
    .string()
    .trim()
    .min(20, "Explain the issue using at least 20 characters.")
    .max(4000, "Use 4,000 characters or fewer."),
});

const providerResponseSchema = z.object({
  caseId: uuidSchema,
  response: z
    .string()
    .trim()
    .min(10, "Write at least 10 characters.")
    .max(4000, "Use 4,000 characters or fewer."),
});

const adminDecisionSchema = z.object({
  caseId: uuidSchema,
  notes: z
    .string()
    .trim()
    .min(10, "Explain the decision using at least 10 characters.")
    .max(4000, "Use 4,000 characters or fewer."),
});

const refundSchema = adminDecisionSchema.extend({
  amount: moneySchema,
  confirmation: z.literal("confirmed", {
    error: "Confirm that this action sends money back through Stripe.",
  }),
});

type PreparedRefundRow = {
  refund_id: string;
  booking_id: string;
  payment_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  amount_cents: number;
  remaining_refundable_cents: number;
};

function success(message: string): CaseActionState {
  return { status: "success", message };
}

function failure(message: string): CaseActionState {
  return { status: "error", message };
}

function amountToCents(amount: string) {
  const [dollars, cents = ""] = amount.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

function caseDatabaseMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  const expected = [
    "only customer accounts",
    "only provider accounts",
    "only auxilium admins",
    "choose a valid request category",
    "explain the issue",
    "booking request not found",
    "only a successfully paid booking",
    "requested refund exceeds",
    "already has an active resolution request",
    "write a response",
    "not available for a response",
    "explain the decision",
    "cannot be denied",
    "no longer open",
    "not eligible for another refund",
    "different amount is already pending",
    "refund amount exceeds",
  ];
  if (expected.some((part) => normalized.includes(part))) {
    return message ?? "Check the resolution request and try again.";
  }
  if (
    normalized.includes("booking_cases") ||
    normalized.includes("open_booking_case") ||
    normalized.includes("prepare_booking_case_refund") ||
    normalized.includes("function") ||
    normalized.includes("relation")
  ) {
    return "Install the booking resolution center migration in Supabase first.";
  }
  return "We could not save that resolution change. Please try again.";
}

function stripeObjectId(value: string | { id: string } | null) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function revalidateResolutionPages() {
  revalidatePath("/dashboard/customer", "layout");
  revalidatePath("/dashboard/provider", "layout");
  revalidatePath("/dashboard/admin/cases", "page");
}

export async function openBookingCase(
  _previousState: CaseActionState,
  formData: FormData,
): Promise<CaseActionState> {
  const parsed = openCaseSchema.safeParse({
    bookingId: formData.get("bookingId"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    details: formData.get("details"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { supabase } = await requireMarketplaceActionRole("customer");
    const { error } = await supabase.rpc("open_booking_case", {
      requested_booking_id: parsed.data.bookingId,
      requested_category: parsed.data.category,
      requested_refund_cents: amountToCents(parsed.data.amount),
      requested_details: parsed.data.details,
    });
    if (error) return failure(caseDatabaseMessage(error.message));

    revalidateResolutionPages();
    return success(
      "Your request was sent to Auxilium. The provider can respond, and an admin will review it before any refund is issued.",
    );
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to open the request.",
    );
  }
}

export async function respondToBookingCase(
  _previousState: CaseActionState,
  formData: FormData,
): Promise<CaseActionState> {
  const parsed = providerResponseSchema.safeParse({
    caseId: formData.get("caseId"),
    response: formData.get("response"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { supabase } = await requireMarketplaceActionRole("provider");
    const { error } = await supabase.rpc("respond_to_booking_case", {
      requested_case_id: parsed.data.caseId,
      response_notes: parsed.data.response,
    });
    if (error) return failure(caseDatabaseMessage(error.message));

    revalidateResolutionPages();
    return success("Your response was added for Auxilium’s review.");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to send the response.",
    );
  }
}

export async function denyBookingCase(
  _previousState: CaseActionState,
  formData: FormData,
): Promise<CaseActionState> {
  const parsed = adminDecisionSchema.safeParse({
    caseId: formData.get("caseId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await requireRole("admin");
    const supabase = await createClient();
    const { error } = await supabase.rpc("deny_booking_case", {
      requested_case_id: parsed.data.caseId,
      review_notes: parsed.data.notes,
    });
    if (error) return failure(caseDatabaseMessage(error.message));

    revalidateResolutionPages();
    return success("Resolution request denied with an audited admin note.");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to save the decision.",
    );
  }
}

export async function refundBookingCase(
  _previousState: CaseActionState,
  formData: FormData,
): Promise<CaseActionState> {
  const parsed = refundSchema.safeParse({
    caseId: formData.get("caseId"),
    amount: formData.get("amount"),
    notes: formData.get("notes"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (!isStripeServerConfigured()) {
    return failure("Stripe server keys are required before issuing a refund.");
  }

  try {
    await requireRole("admin");
    const supabase = await createClient();
    const amountCents = amountToCents(parsed.data.amount);
    const preparedResult = await supabase.rpc("prepare_booking_case_refund", {
      requested_case_id: parsed.data.caseId,
      requested_amount_cents: amountCents,
      review_notes: parsed.data.notes,
    });
    if (preparedResult.error) {
      return failure(caseDatabaseMessage(preparedResult.error.message));
    }

    const prepared = (preparedResult.data?.[0] ?? null) as
      | PreparedRefundRow
      | null;
    if (!prepared || !prepared.stripe_payment_intent_id) {
      return failure("The paid Stripe transaction could not be identified.");
    }

    const stripe = getStripe();
    let chargeId = prepared.stripe_charge_id;
    if (!chargeId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        prepared.stripe_payment_intent_id,
      );
      chargeId = stripeObjectId(paymentIntent.latest_charge);
    }
    if (!chargeId) {
      return failure("Stripe has not attached a refundable charge to this payment.");
    }

    const refund = await stripe.refunds.create(
      {
        charge: chargeId,
        amount: prepared.amount_cents,
        reason: "requested_by_customer",
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: {
          auxilium_refund_id: prepared.refund_id,
          auxilium_case_id: parsed.data.caseId,
          auxilium_booking_id: prepared.booking_id,
          auxilium_payment_id: prepared.payment_id,
        },
      },
      { idempotencyKey: `auxilium_refund_${prepared.refund_id}` },
    );

    const admin = createAdminClient();
    const { error: syncError } = await admin.rpc("record_booking_refund_state", {
      internal_refund_id: prepared.refund_id,
      stripe_refund_id: refund.id,
      payment_intent_id: stripeObjectId(refund.payment_intent),
      charge_id: stripeObjectId(refund.charge),
      refund_amount_cents: refund.amount,
      refund_currency: refund.currency,
      refund_status: refund.status ?? "pending",
      refund_failure_reason: refund.failure_reason ?? null,
      stripe_created: refund.created,
      stripe_event_id: null,
      stripe_event_type: "auxilium.refund_requested",
    });
    if (syncError) {
      console.error("Stripe refund status sync failed", {
        refundId: refund.id,
        message: syncError.message,
      });
      return failure(
        "Stripe accepted the refund, but Auxilium could not confirm its status yet. Retry this same case to reconcile it safely; do not change the amount.",
      );
    }

    revalidateResolutionPages();
    return success(
      refund.status === "succeeded"
        ? "Stripe refund completed. The provider transfer and Auxilium fee were reversed proportionally."
        : "Stripe refund started. Its signed webhook will update the final status.",
    );
  } catch (error) {
    const stripeError = error as {
      code?: unknown;
      requestId?: unknown;
      type?: unknown;
    };
    console.error("Booking refund failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown refund error",
      code: typeof stripeError.code === "string" ? stripeError.code : undefined,
      requestId:
        typeof stripeError.requestId === "string"
          ? stripeError.requestId
          : undefined,
      type: typeof stripeError.type === "string" ? stripeError.type : undefined,
    });
    return failure(
      "Stripe could not confirm the refund. Retry the same case and amount; the idempotency safeguard prevents duplicate refunds.",
    );
  }
}
