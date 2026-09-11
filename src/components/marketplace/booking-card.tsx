import { BookingCancelForm } from "./booking-cancel-form";
import { BookingCompletionForm } from "./booking-completion-form";
import { BookingReviewForm } from "./booking-review-form";
import { BookingResponseForm } from "./booking-response-form";
import Link from "next/link";
import { BookingCheckoutForm } from "@/components/payments/booking-checkout-form";
import { BookingPriceForm } from "@/components/payments/booking-price-form";
import type { BookingRequest } from "@/lib/marketplace/types";
import type { PaymentStatus } from "@/lib/payments/types";
import { formatPrice, labelFromSnakeCase } from "@/lib/providers/presentation";

const statusTone = {
  pending: "border-[#ead6ad] bg-[#fff8e9] text-[#76531c]",
  accepted: "border-[#b9d8c9] bg-[#eef8f2] text-brand-dark",
  declined: "border-red-200 bg-red-50 text-red-800",
  cancelled: "border-border bg-[#f4f5f3] text-muted",
  completed: "border-[#cbd9e7] bg-[#f1f6fb] text-[#244f78]",
} as const;

const paymentTone: Record<PaymentStatus, string> = {
  checkout_pending: "border-[#ead6ad] bg-[#fff8e9] text-[#76531c]",
  processing: "border-[#cbd9e7] bg-[#f1f6fb] text-[#244f78]",
  paid: "border-[#b9d8c9] bg-[#eef8f2] text-brand-dark",
  failed: "border-red-200 bg-red-50 text-red-800",
  expired: "border-border bg-[#f4f5f3] text-muted",
  partially_refunded: "border-[#cbd9e7] bg-[#f1f6fb] text-[#244f78]",
  refunded: "border-border bg-[#f4f5f3] text-muted",
};

const paymentLabel: Record<PaymentStatus, string> = {
  checkout_pending: "Checkout started",
  processing: "Payment processing",
  paid: "Paid",
  failed: "Payment failed",
  expired: "Checkout expired",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatBookingDate(date: string, time: string) {
  const value = new Date(`${date}T${time}:00`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatReviewDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function BookingCard({
  booking,
  perspective,
}: {
  booking: BookingRequest;
  perspective: "customer" | "provider";
}) {
  const canCancel =
    !booking.payment ||
    booking.payment.status === "failed" ||
    booking.payment.status === "expired";
  const paymentFinal =
    booking.payment?.status === "paid" ||
    booking.payment?.status === "processing" ||
    booking.payment?.status === "partially_refunded" ||
    booking.payment?.status === "refunded";
  const canSetPrice =
    booking.status === "accepted" &&
    (!booking.payment ||
      booking.payment.status === "failed" ||
      booking.payment.status === "expired");
  const paymentSupportsCompletion =
    booking.payment?.status === "paid" ||
    booking.payment?.status === "partially_refunded";
  const canMessage =
    booking.status === "pending" ||
    booking.status === "accepted" ||
    booking.status === "completed";
  const platformFeeCents = booking.agreedPriceCents
    ? Math.max(1, Math.round(booking.agreedPriceCents * 0.05))
    : null;

  return (
    <article className="rounded-3xl border border-border bg-white p-6 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
            {booking.serviceName}
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-brand-dark">
            {perspective === "customer" ? booking.providerName : booking.customerName}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {formatPrice(booking.pricingType, booking.priceCents)}
          </p>
          {booking.agreedPriceCents !== null && (
            <p className="mt-2 text-lg font-semibold text-brand-dark">
              Final price: {formatMoney(booking.agreedPriceCents)}
            </p>
          )}
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1.5 text-xs font-bold ${statusTone[booking.status]}`}
        >
          {labelFromSnakeCase(booking.status)}
        </span>
      </div>

      <dl className="mt-6 grid gap-4 rounded-2xl bg-background p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Requested time</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatBookingDate(booking.requestedDate, booking.requestedStartTime)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Service location</dt>
          <dd className="mt-1 font-semibold text-foreground">{booking.serviceLocation}</dd>
        </div>
      </dl>

      {booking.customerNotes && (
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Customer note</p>
          <p className="mt-2 whitespace-pre-wrap leading-7 text-foreground">{booking.customerNotes}</p>
        </div>
      )}

      {booking.providerResponse && (
        <div className="mt-5 rounded-2xl border border-border p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Provider response</p>
          <p className="mt-2 whitespace-pre-wrap leading-7 text-foreground">{booking.providerResponse}</p>
        </div>
      )}

      {(booking.status === "accepted" || booking.status === "completed") && (
        <section className="mt-5 rounded-2xl border border-border bg-[#fbfcfa] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                Payment
              </p>
              <p className="mt-1 text-sm leading-6 text-foreground">
                {booking.agreedPriceCents === null
                  ? perspective === "provider"
                    ? "Set the final price to unlock customer checkout."
                    : "Waiting for the provider to confirm the final price."
                  : perspective === "provider" && platformFeeCents !== null
                    ? `You receive ${formatMoney(booking.agreedPriceCents - platformFeeCents)} after Auxilium’s 5% commission.`
                    : `Secure total: ${formatMoney(booking.agreedPriceCents)}`}
              </p>
            </div>
            {booking.payment && (
              <span
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${paymentTone[booking.payment.status]}`}
              >
                {paymentLabel[booking.payment.status]}
              </span>
            )}
          </div>

          {perspective === "customer" &&
            booking.agreedPriceCents !== null &&
            !paymentFinal && (
              <BookingCheckoutForm
                bookingId={booking.id}
                paymentStatus={booking.payment?.status ?? null}
              />
            )}
        </section>
      )}

      <Link
        href={`/dashboard/messages/${booking.id}`}
        className="mt-5 inline-flex rounded-full border border-brand/25 bg-white px-5 py-2.5 text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-[#f1f7f3]"
      >
        {canMessage
          ? `Message ${perspective === "customer" ? "provider" : "customer"}`
          : "View conversation"}
      </Link>

      {perspective === "provider" && booking.status === "pending" && (
        <BookingResponseForm bookingId={booking.id} />
      )}
      {perspective === "provider" && canSetPrice && (
        <BookingPriceForm
          bookingId={booking.id}
          defaultAmountCents={booking.agreedPriceCents ?? booking.priceCents}
        />
      )}
      {perspective === "provider" &&
        booking.status === "accepted" &&
        paymentSupportsCompletion && (
          <BookingCompletionForm bookingId={booking.id} />
        )}
      {booking.review && (
        <section className="mt-5 rounded-2xl border border-[#d7dfd9] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">
                {perspective === "customer" ? "Your verified review" : "Verified customer review"}
              </p>
              <p className="mt-2 text-lg tracking-[0.08em] text-[#d98f1f]" aria-label={`${booking.review.rating} out of 5 stars`}>
                {"★".repeat(booking.review.rating)}
                <span className="text-[#d9ddd9]">{"★".repeat(5 - booking.review.rating)}</span>
              </p>
            </div>
            <span className="text-xs font-semibold text-muted">
              {formatReviewDate(booking.review.createdAt)}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap leading-7 text-foreground">
            {booking.review.body}
          </p>
        </section>
      )}
      {perspective === "customer" &&
        booking.status === "completed" &&
        paymentSupportsCompletion &&
        !booking.review && <BookingReviewForm bookingId={booking.id} />}
      {perspective === "customer" &&
        (booking.status === "pending" || booking.status === "accepted") &&
        canCancel && (
          <BookingCancelForm bookingId={booking.id} />
        )}
    </article>
  );
}
