import { BookingCancelForm } from "./booking-cancel-form";
import { BookingResponseForm } from "./booking-response-form";
import Link from "next/link";
import type { BookingRequest } from "@/lib/marketplace/types";
import { formatPrice, labelFromSnakeCase } from "@/lib/providers/presentation";

const statusTone = {
  pending: "border-[#ead6ad] bg-[#fff8e9] text-[#76531c]",
  accepted: "border-[#b9d8c9] bg-[#eef8f2] text-brand-dark",
  declined: "border-red-200 bg-red-50 text-red-800",
  cancelled: "border-border bg-[#f4f5f3] text-muted",
} as const;

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

export function BookingCard({
  booking,
  perspective,
}: {
  booking: BookingRequest;
  perspective: "customer" | "provider";
}) {
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

      <Link
        href={`/dashboard/messages/${booking.id}`}
        className="mt-5 inline-flex rounded-full border border-brand/25 bg-white px-5 py-2.5 text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-[#f1f7f3]"
      >
        {booking.status === "pending" || booking.status === "accepted"
          ? `Message ${perspective === "customer" ? "provider" : "customer"}`
          : "View conversation"}
      </Link>

      {perspective === "provider" && booking.status === "pending" && (
        <BookingResponseForm bookingId={booking.id} />
      )}
      {perspective === "customer" &&
        (booking.status === "pending" || booking.status === "accepted") && (
          <BookingCancelForm bookingId={booking.id} />
        )}
    </article>
  );
}
