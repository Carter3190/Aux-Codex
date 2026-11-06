export type ProviderEarnings = {
  status: "confirmed" | "pending" | "unavailable" | "test";
  currency: "usd";
  grossAmountCents: number;
  refundedAmountCents: number;
  /** Application fee still retained after actual application-fee refunds. */
  platformFeeCents: number | null;
  platformFeeRefundedCents: number | null;
  /** Actual Stripe payment costs, including any recorded refund fee credits. */
  stripeFeeCents: number | null;
  /** Per-payment retained earnings; this is not a bank payout status. */
  netEarningsCents: number | null;
  message: string;
};

export type EarningsPayment = {
  amountCents: number;
  platformFeeCents: number;
  refundedAmountCents: number;
  currency: string;
  status: string;
};

export type EarningsBalance = {
  amount: number;
  fee: number;
  net: number;
  currency: string;
  feeDetails: Array<{ amount: number; currency: string; type: string }>;
};

export type EarningsRefund = {
  amount: number;
  currency: string;
  status: string | null;
  balance: EarningsBalance | null;
};

export type ProviderEarningsSnapshot = {
  currency: string;
  amount: number;
  capturedAmount: number;
  refundedAmount: number;
  paid: boolean;
  captured: boolean;
  disputed: boolean;
  balance: EarningsBalance | null;
  applicationFee: {
    amount: number;
    amountRefunded: number;
    currency: string;
  } | null;
  refunds: EarningsRefund[];
  refundsComplete: boolean;
};
