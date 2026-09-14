import "server-only";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import type { BookingPayment, PaymentStatus } from "@/lib/payments/types";
import type {
  AdminResolutionCase,
  BookingCase,
  BookingCaseCategory,
  BookingCaseStatus,
  PaymentDispute,
} from "./types";

export type BookingCaseRow = {
  id: string;
  booking_id: string;
  payment_id: string;
  customer_id: string;
  provider_id: string;
  category: BookingCaseCategory;
  requested_refund_cents: number;
  customer_details: string;
  status: BookingCaseStatus;
  provider_response: string | null;
  provider_responded_at: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  booking_id: string;
  amount_cents: number;
  platform_fee_cents: number;
  refunded_amount_cents: number;
  currency: "usd";
  status: PaymentStatus;
  checkout_expires_at: string | null;
  paid_at: string | null;
  refunded_at: string | null;
};

type BookingSummaryRow = {
  id: string;
  customer_name: string;
  provider_name: string;
  service_name: string;
  status: string;
};

type DisputeRow = {
  id: string;
  payment_id: string;
  stripe_dispute_id: string;
  amount_cents: number;
  currency: string;
  reason: string;
  status: string;
  is_charge_refundable: boolean;
  evidence_due_at: string | null;
  livemode: boolean;
  stripe_created_at: string;
};

export const bookingCaseColumns =
  "id, booking_id, payment_id, customer_id, provider_id, category, requested_refund_cents, customer_details, status, provider_response, provider_responded_at, admin_notes, resolved_at, created_at";

export function resolutionMigrationMissing(code?: string) {
  return code === "42P01" || code === "42703" || code === "PGRST202" || code === "PGRST205";
}

export function mapBookingCase(row: BookingCaseRow): BookingCase {
  return {
    id: row.id,
    bookingId: row.booking_id,
    paymentId: row.payment_id,
    customerId: row.customer_id,
    providerId: row.provider_id,
    category: row.category,
    requestedRefundCents: row.requested_refund_cents,
    customerDetails: row.customer_details,
    status: row.status,
    providerResponse: row.provider_response,
    providerRespondedAt: row.provider_responded_at,
    adminNotes: row.admin_notes,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

function mapPayment(row: PaymentRow): BookingPayment {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    platformFeeCents: row.platform_fee_cents,
    refundedAmountCents: row.refunded_amount_cents,
    currency: row.currency,
    status: row.status,
    checkoutExpiresAt: row.checkout_expires_at,
    paidAt: row.paid_at,
    refundedAt: row.refunded_at,
  };
}

export async function getAdminResolutionWorkspace(): Promise<{
  admin: Awaited<ReturnType<typeof requireRole>>;
  cases: AdminResolutionCase[];
  disputes: PaymentDispute[];
}> {
  const admin = await requireRole("admin");
  const supabase = await createClient();
  const [casesResult, disputesResult] = await Promise.all([
    supabase
      .from("booking_cases")
      .select(bookingCaseColumns)
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_disputes")
      .select(
        "id, payment_id, stripe_dispute_id, amount_cents, currency, reason, status, is_charge_refundable, evidence_due_at, livemode, stripe_created_at",
      )
      .order("stripe_created_at", { ascending: false }),
  ]);

  if (casesResult.error || disputesResult.error) {
    const error = casesResult.error ?? disputesResult.error;
    if (resolutionMigrationMissing(error?.code)) {
      redirect("/setup?reason=resolution-center");
    }
    throw new Error("Unable to load the resolution center.");
  }

  const caseRows = (casesResult.data ?? []) as BookingCaseRow[];
  const disputeRows = (disputesResult.data ?? []) as DisputeRow[];
  const paymentIds = Array.from(
    new Set([
      ...caseRows.map((row) => row.payment_id),
      ...disputeRows.map((row) => row.payment_id),
    ]),
  );

  if (paymentIds.length === 0) return { admin, cases: [], disputes: [] };

  const paymentsResult = await supabase
    .from("booking_payments")
    .select(
      "id, booking_id, amount_cents, platform_fee_cents, refunded_amount_cents, currency, status, checkout_expires_at, paid_at, refunded_at",
    )
    .in("id", paymentIds);
  if (paymentsResult.error) {
    throw new Error("Unable to load resolution payment records.");
  }

  const paymentRows = (paymentsResult.data ?? []) as PaymentRow[];
  const paymentById = new Map(paymentRows.map((row) => [row.id, row]));
  const bookingIds = Array.from(new Set(paymentRows.map((row) => row.booking_id)));
  const bookingsResult = await supabase
    .from("booking_requests")
    .select("id, customer_name, provider_name, service_name, status")
    .in("id", bookingIds);
  if (bookingsResult.error) {
    throw new Error("Unable to load resolution booking records.");
  }

  const bookingById = new Map(
    ((bookingsResult.data ?? []) as BookingSummaryRow[]).map((row) => [
      row.id,
      row,
    ]),
  );

  const cases = caseRows.flatMap((row): AdminResolutionCase[] => {
    const payment = paymentById.get(row.payment_id);
    const booking = payment ? bookingById.get(payment.booking_id) : undefined;
    if (!payment || !booking) return [];
    return [
      {
        ...mapBookingCase(row),
        customerName: booking.customer_name,
        providerName: booking.provider_name,
        serviceName: booking.service_name,
        bookingStatus: booking.status,
        payment: mapPayment(payment),
      },
    ];
  });

  const disputes = disputeRows.flatMap((row): PaymentDispute[] => {
    const payment = paymentById.get(row.payment_id);
    const booking = payment ? bookingById.get(payment.booking_id) : undefined;
    if (!payment || !booking) return [];
    return [
      {
        id: row.id,
        paymentId: row.payment_id,
        stripeDisputeId: row.stripe_dispute_id,
        amountCents: row.amount_cents,
        currency: row.currency,
        reason: row.reason,
        status: row.status,
        isChargeRefundable: row.is_charge_refundable,
        evidenceDueAt: row.evidence_due_at,
        livemode: row.livemode,
        createdAt: row.stripe_created_at,
        customerName: booking.customer_name,
        providerName: booking.provider_name,
        serviceName: booking.service_name,
      },
    ];
  });

  return { admin, cases, disputes };
}
