import type { BookingPayment } from "@/lib/payments/types";

export type BookingCaseCategory =
  | "cancellation"
  | "service_issue"
  | "duplicate_charge"
  | "other";

export type BookingCaseStatus =
  | "open"
  | "provider_responded"
  | "under_review"
  | "resolved_refunded"
  | "resolved_partially_refunded"
  | "denied"
  | "closed";

export type BookingCase = {
  id: string;
  bookingId: string;
  paymentId: string;
  customerId: string;
  providerId: string;
  category: BookingCaseCategory;
  requestedRefundCents: number;
  customerDetails: string;
  status: BookingCaseStatus;
  providerResponse: string | null;
  providerRespondedAt: string | null;
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type AdminResolutionCase = BookingCase & {
  customerName: string;
  providerName: string;
  serviceName: string;
  bookingStatus: string;
  payment: BookingPayment;
  refundPending: boolean;
  pendingRefund: PendingBookingRefund | null;
};

export type PendingBookingRefund = {
  id: string;
  amountCents: number;
  status: "pending" | "requires_action";
  stripeRefundId: string | null;
  createdAt: string;
  canRetry: boolean;
};

export type PaymentDispute = {
  id: string;
  paymentId: string;
  stripeDisputeId: string;
  amountCents: number;
  currency: string;
  reason: string;
  status: string;
  isChargeRefundable: boolean;
  evidenceDueAt: string | null;
  livemode: boolean;
  createdAt: string;
  customerName: string;
  providerName: string;
  serviceName: string;
};

export type CaseActionState = {
  status?: "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  refundPending?: boolean;
};

export const initialCaseActionState: CaseActionState = {};
