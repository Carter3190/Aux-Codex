"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMarketplaceActionRole } from "@/lib/marketplace/data";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAppUrl,
  isStripeServerConfigured,
  isStripeWebhookConfigured,
} from "@/lib/stripe/config";
import { getStripe } from "@/lib/stripe/server";
import { syncProviderPaymentAccount } from "./data";
import type { PaymentActionState } from "./types";

const bookingIdSchema = z.uuid("Invalid booking request.");
const priceSchema = z.object({
  bookingId: bookingIdSchema,
  amount: z
    .string()
    .trim()
    .regex(
      /^\d{1,7}(?:\.\d{1,2})?$/,
      "Enter a dollar amount with no more than two decimal places.",
    ),
});

type PaymentAccountRow = {
  stripe_account_id: string;
};

type PreparedPaymentRow = {
  payment_id: string;
  provider_id: string;
  stripe_account_id: string;
  amount_cents: number;
  platform_fee_cents: number;
  checkout_attempt: number;
  stripe_checkout_session_id: string | null;
  checkout_expires_at: string | null;
};

function success(message: string): PaymentActionState {
  return { status: "success", message };
}

function failure(message: string): PaymentActionState {
  return { status: "error", message };
}

function amountToCents(amount: string) {
  const [dollars, cents = ""] = amount.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

function paymentDatabaseMessage(message?: string) {
  const normalized = message?.toLowerCase() ?? "";
  const expected = [
    "only approved providers",
    "booking request not found",
    "set a price only after",
    "price cannot change",
    "only customer accounts",
    "only accepted bookings",
    "provider must set a final price",
    "provider must finish stripe",
    "already has a payment",
    "between $1.00",
  ];

  if (expected.some((part) => normalized.includes(part))) {
    return message ?? "Check the payment details and try again.";
  }
  if (normalized.includes("function") || normalized.includes("relation")) {
    return "Install the Stripe payments migration in Supabase first.";
  }
  return "We could not save that payment change. Please try again.";
}

export async function setBookingPrice(
  _previousState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const parsed = priceSchema.safeParse({
    bookingId: formData.get("bookingId"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const amountCents = amountToCents(parsed.data.amount);
  if (amountCents < 100 || amountCents > 100000000) {
    return failure("Enter a final price between $1.00 and $1,000,000.00.");
  }

  try {
    const { supabase } = await requireMarketplaceActionRole("provider");
    const { error } = await supabase.rpc("set_booking_price", {
      requested_booking_id: parsed.data.bookingId,
      requested_amount_cents: amountCents,
    });
    if (error) return failure(paymentDatabaseMessage(error.message));

    revalidatePath("/dashboard/provider", "layout");
    revalidatePath("/dashboard/customer", "layout");
    return success("Final booking price saved.");
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to save the price.",
    );
  }
}

export async function startStripeOnboarding(
  _previousState: PaymentActionState,
  _formData: FormData,
): Promise<PaymentActionState> {
  void _previousState;
  void _formData;

  if (!isStripeServerConfigured()) {
    return failure(
      "Stripe server keys must be added before provider payout setup can begin.",
    );
  }

  let onboardingUrl: string | undefined;

  try {
    const { supabase, userId } =
      await requireMarketplaceActionRole("provider");
    const [profileResult, detailsResult, claimsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, provider_status")
        .eq("id", userId)
        .single(),
      supabase
        .from("provider_details")
        .select("business_name")
        .eq("provider_id", userId)
        .maybeSingle(),
      supabase.auth.getClaims(),
    ]);

    if (
      profileResult.error ||
      profileResult.data?.provider_status !== "approved"
    ) {
      return failure(
        "Your provider profile must be approved before connecting payouts.",
      );
    }

    const admin = createAdminClient();
    const existing = await admin
      .from("provider_payment_accounts")
      .select("stripe_account_id")
      .eq("provider_id", userId)
      .maybeSingle();

    if (existing.error) {
      return failure(paymentDatabaseMessage(existing.error.message));
    }

    const stripe = getStripe();
    let stripeAccountId = (existing.data as PaymentAccountRow | null)
      ?.stripe_account_id;

    if (!stripeAccountId) {
      const account = await stripe.v2.core.accounts.create(
        {
          contact_email:
            typeof claimsResult.data?.claims?.email === "string"
              ? claimsResult.data.claims.email
              : undefined,
          display_name:
            detailsResult.data?.business_name || profileResult.data.full_name,
          dashboard: "express",
          identity: {
            country: "us",
          },
          defaults: {
            currency: "usd",
            locales: ["en-US"],
            profile: {
              doing_business_as:
                detailsResult.data?.business_name ||
                profileResult.data.full_name,
              product_description:
                "Local services booked through the Auxilium marketplace.",
            },
            responsibilities: {
              fees_collector: "application",
              losses_collector: "application",
            },
          },
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: {
                  stripe_transfers: { requested: true },
                },
              },
            },
          },
          include: ["configuration.recipient", "identity", "requirements"],
          metadata: {
            auxilium_provider_id: userId,
          },
        },
        { idempotencyKey: `auxilium_provider_v2_${userId}` },
      );
      stripeAccountId = account.id;

      const { error: saveError } = await admin
        .from("provider_payment_accounts")
        .insert({ provider_id: userId, stripe_account_id: account.id });
      if (saveError) {
        return failure(paymentDatabaseMessage(saveError.message));
      }
    }

    await syncProviderPaymentAccount(userId, stripeAccountId);
    const appUrl = getAppUrl();
    const link = await stripe.v2.core.accountLinks.create({
      account: stripeAccountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: `${appUrl}/dashboard/provider?stripe=refresh`,
          return_url: `${appUrl}/dashboard/provider?stripe=return`,
          collection_options: { fields: "eventually_due" },
        },
      },
    });
    onboardingUrl = link.url;
  } catch (error) {
    const stripeError = error as {
      code?: unknown;
      requestId?: unknown;
      type?: unknown;
    };
    console.error("Stripe provider onboarding failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown Stripe error",
      code: typeof stripeError?.code === "string" ? stripeError.code : undefined,
      requestId:
        typeof stripeError?.requestId === "string"
          ? stripeError.requestId
          : undefined,
      type: typeof stripeError?.type === "string" ? stripeError.type : undefined,
    });
    return failure(
      "Stripe could not start payout setup. Confirm the server keys and Connect settings, then try again.",
    );
  }

  redirect(onboardingUrl);
}

export async function startBookingCheckout(
  _previousState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const bookingId = bookingIdSchema.safeParse(formData.get("bookingId"));
  if (!bookingId.success) return failure("Invalid booking request.");

  if (!isStripeWebhookConfigured()) {
    return failure(
      "Secure checkout will open after the signed Stripe webhook is configured.",
    );
  }

  let checkoutUrl: string | undefined;

  try {
    const { supabase, userId } =
      await requireMarketplaceActionRole("customer");
    const [bookingResult, claimsResult] = await Promise.all([
      supabase
        .from("booking_requests")
        .select(
          "id, customer_id, provider_id, provider_name, service_name, status, agreed_price_cents",
        )
        .eq("id", bookingId.data)
        .eq("customer_id", userId)
        .single(),
      supabase.auth.getClaims(),
    ]);

    if (bookingResult.error || !bookingResult.data) {
      return failure("Booking request not found.");
    }

    const admin = createAdminClient();
    const accountResult = await admin
      .from("provider_payment_accounts")
      .select("stripe_account_id")
      .eq("provider_id", bookingResult.data.provider_id)
      .single();
    if (accountResult.error || !accountResult.data) {
      return failure(
        "This provider must finish Stripe payout setup before payment.",
      );
    }

    const accountRow = accountResult.data as PaymentAccountRow;
    const accountStatus = await syncProviderPaymentAccount(
      bookingResult.data.provider_id,
      accountRow.stripe_account_id,
    );
    if (!accountStatus.ready) {
      return failure(
        "This provider must finish Stripe payout setup before payment.",
      );
    }

    const preparedResult = await supabase.rpc("prepare_booking_payment", {
      requested_booking_id: bookingId.data,
    });
    if (preparedResult.error) {
      return failure(paymentDatabaseMessage(preparedResult.error.message));
    }

    const prepared = (preparedResult.data?.[0] ?? null) as
      | PreparedPaymentRow
      | null;
    if (!prepared) return failure("Unable to prepare secure checkout.");

    const stripe = getStripe();
    if (prepared.stripe_checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        prepared.stripe_checkout_session_id,
      );
      if (existingSession.status === "open" && existingSession.url) {
        checkoutUrl = existingSession.url;
      } else if (existingSession.status === "complete") {
        return failure(
          "This checkout is already complete. Refresh the dashboard to see the payment status.",
        );
      }
    }

    if (!checkoutUrl) {
      const appUrl = getAppUrl();
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          payment_method_types: ["card"],
          submit_type: "book",
          client_reference_id: bookingId.data,
          customer_email:
            typeof claimsResult.data?.claims?.email === "string"
              ? claimsResult.data.claims.email
              : undefined,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: prepared.amount_cents,
                product_data: {
                  name: `${bookingResult.data.service_name} with ${bookingResult.data.provider_name}`,
                  description: "Auxilium booking payment",
                },
              },
            },
          ],
          payment_intent_data: {
            application_fee_amount: prepared.platform_fee_cents,
            transfer_data: {
              destination: prepared.stripe_account_id,
            },
            receipt_email:
              typeof claimsResult.data?.claims?.email === "string"
                ? claimsResult.data.claims.email
                : undefined,
            metadata: {
              auxilium_booking_id: bookingId.data,
              auxilium_payment_id: prepared.payment_id,
            },
          },
          metadata: {
            auxilium_booking_id: bookingId.data,
            auxilium_payment_id: prepared.payment_id,
            auxilium_customer_id: userId,
            auxilium_provider_id: prepared.provider_id,
          },
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
          success_url: `${appUrl}/dashboard/customer?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/dashboard/customer?payment=cancelled`,
        },
        {
          idempotencyKey: `auxilium_booking_${bookingId.data}_attempt_${prepared.checkout_attempt}`,
        },
      );

      if (!session.url) {
        return failure("Stripe did not return a secure checkout link.");
      }

      const { error: saveError } = await admin
        .from("booking_payments")
        .update({
          stripe_checkout_session_id: session.id,
          checkout_expires_at: new Date(session.expires_at * 1000).toISOString(),
        })
        .eq("id", prepared.payment_id)
        .eq("checkout_attempt", prepared.checkout_attempt)
        .eq("status", "checkout_pending");
      if (saveError) {
        return failure("Unable to save the secure checkout session.");
      }

      checkoutUrl = session.url;
    }
  } catch {
    return failure(
      "Stripe could not start checkout. Please wait a moment and try again.",
    );
  }

  redirect(checkoutUrl);
}
