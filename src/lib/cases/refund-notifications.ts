import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBookingParticipants } from "@/lib/email/notifications";
import { bookingRefundNotification } from "./refund-status";

/** Called only after the authorized action or verified webhook has recorded
 * Stripe's result. Read the ledger instead of announcing an unrecorded result.
 */
export async function notifyRecordedBookingRefund(
  reference: { refundId: string } | { stripeRefundId: string },
) {
  try {
    const admin = createAdminClient();
    const query = admin.from("booking_refunds")
      .select("id, payment_id, amount_cents, status");
    const { data: refund, error } = await ("refundId" in reference
      ? query.eq("id", reference.refundId)
      : query.eq("stripe_refund_id", reference.stripeRefundId)).single();
    if (error || !refund) return;
    const notification = bookingRefundNotification({
      id: refund.id, amountCents: refund.amount_cents, status: refund.status,
    });
    if (!notification) return;
    const payment = await admin.from("booking_payments").select("booking_id")
      .eq("id", refund.payment_id).single();
    if (payment.error || !payment.data?.booking_id) return;
    await notifyBookingParticipants({
      ...notification,
      bookingId: payment.data.booking_id,
      recipients: ["customer", "provider"],
    });
  } catch (error) {
    // Notification delivery must not interrupt financial reconciliation.
    console.error("Refund notification preparation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
