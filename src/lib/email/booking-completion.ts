export type BookingCompletionEmailInput = {
  bookingId: string;
  customerId: string;
  recipientName: string;
  providerName: string;
  serviceName: string;
  requestedDate: string;
  requestedStartTime?: string;
  agreedPriceCents: number | null;
  paymentStatus: string | null;
  paymentAmountCents?: number | null;
  refundedAmountCents?: number | null;
};

export type BookingCompletionEmailContent = {
  subject: string;
  heading: string;
  recipientName: string;
  introduction: string;
  details: Array<{ label: string; value: string }>;
  instructions: string;
  paymentNote: string;
  actionLabel: string;
  actionPath: string;
  idempotencyKey: string;
  bookingId: string;
};

function money(cents: number | null | undefined) {
  if (!Number.isSafeInteger(cents) || (cents ?? -1) < 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents! / 100);
}

function visitDate(value: string, time?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "See your booking";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "See your booking";
  const formatted = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
  const matched = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time ?? "");
  if (!matched || Number(matched[1]) > 23 || Number(matched[2]) > 59) return formatted;
  const hour = Number(matched[1]);
  return `${formatted} · ${hour % 12 || 12}:${matched[2]} ${hour < 12 ? "AM" : "PM"}`;
}

export function createBookingCompletionEmail(
  input: BookingCompletionEmailInput,
): BookingCompletionEmailContent {
  const details = [
    { label: "Booking", value: input.bookingId },
    { label: "Visit date", value: visitDate(input.requestedDate, input.requestedStartTime) },
    { label: "Provider", value: input.providerName },
    { label: "Service", value: input.serviceName },
  ];
  const due = money(input.agreedPriceCents);
  let instructions = "Review the completed work, view any completion photos, and check the payment details in your booking.";
  let paymentNote = "Review your booking for the latest payment status.";

  if (input.paymentStatus === "paid" || input.paymentStatus === "partially_refunded") {
    details.push({ label: "Payment status", value: input.paymentStatus === "paid" ? "Paid" : "Partially refunded" });
    const collected = money(input.paymentAmountCents);
    const refunded = money(input.refundedAmountCents);
    if (collected) details.push({ label: "Amount collected", value: collected });
    if (input.paymentStatus === "partially_refunded" && refunded) details.push({ label: "Amount refunded", value: refunded });
    instructions = "Review the completed work, view any completion photos, and share your experience from your booking.";
    paymentNote = "Your payment has already been received. No additional payment is requested by this email.";
  } else if (input.paymentStatus === "refunded") {
    details.push({ label: "Payment status", value: "Refunded" });
    paymentNote = "Your payment has been refunded. Review your booking for the payment details.";
  } else if (input.paymentStatus === "processing" || input.paymentStatus === "checkout_pending") {
    details.push({ label: "Payment status", value: input.paymentStatus === "processing" ? "Processing" : "Checkout in progress" });
    paymentNote = "A payment attempt is in progress. Check its status in your booking before trying again.";
  } else if (due && (input.paymentStatus === null || ["failed", "expired"].includes(input.paymentStatus))) {
    details.push({ label: "Payment due", value: due });
    instructions = "Review the completed work, view any completion photos, and pay securely from your booking.";
    paymentNote = "Marking the service complete does not charge you automatically.";
  }

  return {
    subject: `Your service is complete — booking ${input.bookingId.slice(0, 8).toUpperCase()}`,
    heading: "Your service is complete",
    recipientName: input.recipientName,
    introduction: `${input.providerName} has marked your ${input.serviceName} complete.`,
    details,
    instructions,
    paymentNote,
    actionLabel: "View completed booking",
    actionPath: `/dashboard/customer/bookings/${encodeURIComponent(input.bookingId)}?tab=overview`,
    idempotencyKey: `booking_completed_${input.bookingId}_${input.customerId}`,
    bookingId: input.bookingId,
  };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function renderBookingCompletionEmail(
  content: BookingCompletionEmailContent,
  actionUrl: string,
) {
  const detailRows: string[] = [];
  for (let index = 0; index < content.details.length; index += 2) {
    const cells = content.details.slice(index, index + 2).map((detail) =>
      `<td width="50%" valign="top" style="padding:0 12px 20px 0;word-break:break-word"><div style="color:#586c84;font-size:12px;line-height:1.6">${escapeHtml(detail.label)}</div><div style="margin-top:4px;color:#203346;font-size:14px;line-height:1.7;overflow-wrap:anywhere">${escapeHtml(detail.value)}</div></td>`,
    );
    if (cells.length === 1) cells.push('<td width="50%"></td>');
    detailRows.push(`<tr>${cells.join("")}</tr>`);
  }

  const html = `<!doctype html>
<html lang="en"><body style="margin:0;background:#f2f5f8;color:#203346;font-family:Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(content.heading)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#f2f5f8"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fff;border:1px solid #d9e3ee;border-radius:16px;overflow:hidden">
<tr><td style="padding:28px 24px 0;color:#345f94;font-size:27px;font-weight:700;letter-spacing:-1px">Auxilium</td></tr>
<tr><td style="padding:28px 24px">
<h1 style="margin:0 0 24px;font-size:25px;line-height:1.3;color:#203346">${escapeHtml(content.heading)}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.7">Hi ${escapeHtml(content.recipientName)},</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.7">${escapeHtml(content.introduction)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${detailRows.join("")}</table>
<p style="margin:4px 0 24px;font-size:15px;line-height:1.7">${escapeHtml(content.instructions)}</p>
<a href="${escapeHtml(actionUrl)}" style="display:inline-block;max-width:100%;box-sizing:border-box;padding:13px 18px;border:1px solid #345f94;border-radius:10px;background:#345f94;color:#fff;text-decoration:none;font-size:14px;font-weight:700;line-height:1.5">${escapeHtml(content.actionLabel)}</a>
<p style="margin:24px 0 18px;color:#586c84;font-size:12px;line-height:1.7">Completion photos, when provided, are available in your booking after you sign in.</p>
<p style="margin:0;color:#586c84;font-size:14px;line-height:1.7">${escapeHtml(content.paymentNote)}</p>
</td></tr><tr><td style="padding:18px 24px;border-top:1px solid #d9e3ee;color:#586c84;font-size:12px;line-height:1.7;overflow-wrap:anywhere">Auxilium · Booking ${escapeHtml(content.bookingId)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Hi ${content.recipientName},`, "", content.heading, content.introduction, "",
    ...content.details.map((detail) => `${detail.label}: ${detail.value}`), "",
    content.instructions, "", `${content.actionLabel}: ${actionUrl}`, "",
    "Completion photos, when provided, are available in your booking after you sign in.",
    content.paymentNote, "", `Auxilium · Booking ${content.bookingId}`,
  ].join("\n");
  return { html, text };
}
