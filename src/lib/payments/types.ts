export type PaymentStatus =
  | "checkout_pending"
  | "processing"
  | "paid"
  | "failed"
  | "expired"
  | "partially_refunded"
  | "refunded";

export type BookingPayment = {
  id: string;
  amountCents: number;
  platformFeeCents: number;
  refundedAmountCents: number;
  currency: "usd";
  status: PaymentStatus;
  checkoutExpiresAt: string | null;
  paidAt: string | null;
  refundedAt: string | null;
};

export type ProviderPaymentSetup = {
  configured: boolean;
  migrationInstalled: boolean;
  hasAccount: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  transfersActive: boolean;
  requirementsDueCount: number;
  ready: boolean;
  message?: string;
};

export type PaymentActionState = {
  status?: "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialPaymentActionState: PaymentActionState = {};
