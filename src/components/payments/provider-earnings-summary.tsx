import type { BookingRequest } from "@/lib/marketplace/types";
import type { ProviderEarnings } from "@/lib/payments/provider-earnings-types";
import { formatCustomerMoney } from "@/lib/marketplace/customer-dashboard";
import styles from "./provider-earnings-summary.module.css";

export function ProviderEarningsSummary({ booking, earnings }: {
  booking: Pick<BookingRequest, "agreedPriceCents" | "payment">;
  earnings?: ProviderEarnings;
}) {
  const payment = booking.payment;
  const total = earnings?.grossAmountCents ?? payment?.amountCents ?? booking.agreedPriceCents;
  const refunded = earnings?.refundedAmountCents ?? payment?.refundedAmountCents ?? 0;
  const captured = payment && ["paid", "partially_refunded", "refunded"].includes(payment.status);
  const platformFee = earnings?.platformFeeCents ?? (captured || refunded > 0 ? null
    : payment?.platformFeeCents ?? (total === null ? null : Math.max(1, Math.round(total * 0.05))));
  const deduction = (cents: number) => formatCustomerMoney(cents === 0 ? 0 : -cents);
  const feePlaceholder = captured ? earnings?.status === "unavailable" ? "Unavailable" : "Pending fee details" : "Available after payment";

  return (
    <div className={styles.summary}>
      <dl className={styles.amounts}>
        <div><dt>Customer total</dt><dd>{total === null ? "Price not set" : formatCustomerMoney(total)}</dd></div>
        {refunded > 0 && <div><dt>Customer refunds</dt><dd>{deduction(refunded)}</dd></div>}
        <div><dt>{refunded > 0 || (earnings?.platformFeeRefundedCents ?? 0) > 0 ? "Auxilium fee retained" : "Auxilium fee (5%)"}</dt><dd>{platformFee === null ? "Pending fee details" : deduction(platformFee)}</dd></div>
        <div><dt>Stripe processing fee</dt><dd>{earnings?.stripeFeeCents === null || earnings?.stripeFeeCents === undefined ? feePlaceholder : deduction(earnings.stripeFeeCents)}</dd></div>
        <div className={styles.net}><dt>Net earnings</dt><dd>{earnings?.status === "confirmed" && earnings.netEarningsCents !== null ? formatCustomerMoney(earnings.netEarningsCents) : feePlaceholder}</dd></div>
      </dl>
      <p className={styles.note}>{earnings?.message ?? "Stripe confirms its processing fee after payment. Net earnings appear when the actual fee is available."}</p>
    </div>
  );
}
