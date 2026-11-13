import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingCompletionEmail, sendTransactionalEmail, type TransactionalEmailResult } from "./send";

type RecipientRole = "customer" | "provider" | "admin";

type BookingRow = {
  id: string;
  customer_id: string;
  provider_id: string;
  customer_name: string;
  provider_name: string;
  service_name: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role: RecipientRole;
};

type BookingNotification = {
  bookingId: string;
  recipients: RecipientRole[];
  eventKey: string;
  subject: string;
  heading: string;
  message: string;
};

type ProfileNotification = {
  providerId: string;
  recipients: Array<"provider" | "admin">;
  eventKey: string;
  subject: string;
  heading: string;
  message: string;
};

function actionPath(role: RecipientRole) {
  if (role === "admin") return "/dashboard/admin/cases";
  if (role === "provider") return "/dashboard/provider";
  return "/dashboard/customer";
}

async function adminProfiles() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("role", "admin");
  if (error) return [];
  return (data ?? []) as ProfileRow[];
}

export async function notifyBookingCompletion(
  input: { bookingId: string },
): Promise<TransactionalEmailResult> {
  try {
    const admin = createAdminClient();
    const { data: booking, error: bookingError } = await admin
      .from("booking_requests")
      .select("id, customer_id, customer_name, provider_name, service_name, requested_date, requested_start_time, agreed_price_cents, status")
      .eq("id", input.bookingId)
      .single();
    if (bookingError) throw new Error("BookingUnavailable");
    if (!booking || booking.status !== "completed") return { status: "skipped" };

    const [customerResult, paymentResult] = await Promise.all([
      admin.from("profiles").select("id, email, full_name")
        .eq("id", booking.customer_id).single(),
      admin.from("booking_payments").select("status, amount_cents, refunded_amount_cents")
        .eq("booking_id", booking.id).maybeSingle(),
    ]);
    if (customerResult.error || paymentResult.error) throw new Error("CompletionDetailsUnavailable");
    const customer = customerResult.data;
    if (!customer?.email || customer.id !== booking.customer_id) return { status: "skipped" };

    return await sendBookingCompletionEmail({
      to: customer.email,
      bookingId: booking.id,
      customerId: customer.id,
      recipientName: customer.full_name || booking.customer_name,
      providerName: booking.provider_name,
      serviceName: booking.service_name,
      requestedDate: booking.requested_date,
      requestedStartTime: booking.requested_start_time,
      agreedPriceCents: booking.agreed_price_cents,
      paymentStatus: paymentResult.data?.status ?? null,
      paymentAmountCents: paymentResult.data?.amount_cents ?? null,
      refundedAmountCents: paymentResult.data?.refunded_amount_cents ?? null,
    });
  } catch (error) {
    console.error("Completion notification preparation failed", {
      event: `booking_completed_${input.bookingId}`,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { status: "failed" };
  }
}

export async function notifyBookingParticipants(
  input: BookingNotification,
) {
  try {
    const admin = createAdminClient();
    const { data: booking, error: bookingError } = await admin
      .from("booking_requests")
      .select(
        "id, customer_id, provider_id, customer_name, provider_name, service_name",
      )
      .eq("id", input.bookingId)
      .single();
    if (bookingError || !booking) return;

    const row = booking as BookingRow;
    const participantIds = [row.customer_id, row.provider_id];
    const [{ data: participantData, error: participantError }, admins] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id, email, full_name, role")
          .in("id", participantIds),
        input.recipients.includes("admin") ? adminProfiles() : Promise.resolve([]),
      ]);
    if (participantError) return;

    const participantProfiles = (participantData ?? []) as ProfileRow[];
    const targets = [
      ...participantProfiles.filter((profile) =>
        input.recipients.includes(profile.role),
      ),
      ...admins,
    ];

    await Promise.all(
      targets.map((target) =>
        sendTransactionalEmail({
          to: target.email,
          recipientName: target.full_name,
          subject: input.subject,
          heading: input.heading,
          message: `${input.message} Service: ${row.service_name}.`,
          actionLabel:
            target.role === "admin" ? "Review in Auxilium" : "Open your dashboard",
          actionPath: actionPath(target.role),
          idempotencyKey: `${input.eventKey}_${target.id}`,
        }),
      ),
    );
  } catch (error) {
    console.error("Booking notification preparation failed", {
      event: input.eventKey,
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export async function notifyCaseParticipants(
  input: Omit<BookingNotification, "bookingId"> & { caseId: string },
) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("booking_cases")
      .select("booking_id")
      .eq("id", input.caseId)
      .single();
    if (error || !data?.booking_id) return;

    await notifyBookingParticipants({
      bookingId: data.booking_id,
      recipients: input.recipients,
      eventKey: input.eventKey,
      subject: input.subject,
      heading: input.heading,
      message: input.message,
    });
  } catch (error) {
    console.error("Resolution notification preparation failed", {
      event: input.eventKey,
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export async function notifyProviderApplication(input: ProfileNotification) {
  try {
    const admin = createAdminClient();
    const [{ data, error }, admins] = await Promise.all([
      admin
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("id", input.providerId)
        .eq("role", "provider")
        .single(),
      input.recipients.includes("admin") ? adminProfiles() : Promise.resolve([]),
    ]);
    if (error || !data) return;

    const provider = data as ProfileRow;
    const targets = [
      ...(input.recipients.includes("provider") ? [provider] : []),
      ...admins,
    ];

    await Promise.all(
      targets.map((target) =>
        sendTransactionalEmail({
          to: target.email,
          recipientName: target.full_name,
          subject: input.subject,
          heading: input.heading,
          message: input.message,
          actionLabel:
            target.role === "admin"
              ? "Review provider application"
              : "Open your provider dashboard",
          actionPath:
            target.role === "admin" ? "/dashboard/admin" : "/dashboard/provider",
          idempotencyKey: `${input.eventKey}_${target.id}`,
        }),
      ),
    );
  } catch (error) {
    console.error("Provider notification preparation failed", {
      event: input.eventKey,
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
