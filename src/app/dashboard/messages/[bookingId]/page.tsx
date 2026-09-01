import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ConversationLiveUpdates } from "@/components/messages/conversation-live-updates";
import { MessageComposer } from "@/components/messages/message-composer";
import { getBookingConversation } from "@/lib/marketplace/data";
import { labelFromSnakeCase } from "@/lib/providers/presentation";

export const metadata: Metadata = {
  title: "Conversation",
};

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBookingDate(date: string, time: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(`${date}T${time}:00`));
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const parsedId = z.uuid().safeParse(bookingId);
  if (!parsedId.success) notFound();

  const conversation = await getBookingConversation(parsedId.data);
  if (!conversation) notFound();
  const { profile, booking, messages, counterpartName, canSend } = conversation;

  return (
    <DashboardShell
      profile={profile}
      eyebrow="Booking conversation"
      title={counterpartName}
    >
      <Link
        href="/dashboard/messages"
        className="inline-flex text-sm font-semibold text-brand hover:text-brand-dark"
      >
        ← All conversations
      </Link>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-3xl border border-border bg-white">
          <div className="border-b border-border bg-[#f7faf7] px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.13em] text-brand">
                  {booking.serviceName}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatBookingDate(booking.requestedDate, booking.requestedStartTime)}
                </p>
              </div>
              <span className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-bold text-brand-dark">
                {labelFromSnakeCase(booking.status)}
              </span>
            </div>
          </div>

          <div className="max-h-[600px] min-h-[360px] space-y-5 overflow-y-auto bg-[#fbfcfa] p-5 sm:p-7">
            {messages.length === 0 ? (
              <div className="flex min-h-72 items-center justify-center text-center">
                <div>
                  <h2 className="text-xl font-semibold text-brand-dark">Start the conversation</h2>
                  <p className="mx-auto mt-2 max-w-md leading-7 text-muted">
                    Ask a question or coordinate the next step for this booking.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isOwn = message.senderId === profile.id;
                const senderName = isOwn
                  ? "You"
                  : message.senderId === booking.customerId
                    ? booking.customerName
                    : booking.providerName;
                return (
                  <article
                    key={message.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] sm:max-w-[70%] ${isOwn ? "text-right" : "text-left"}`}>
                      <p className="mb-1 text-xs font-semibold text-muted">
                        {senderName} · {formatMessageTime(message.createdAt)}
                      </p>
                      <p
                        className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-left leading-7 ${
                          isOwn
                            ? "rounded-br-md bg-brand text-white"
                            : "rounded-bl-md border border-border bg-white text-foreground"
                        }`}
                      >
                        {message.body}
                      </p>
                    </div>
                  </article>
                );
              })
            )}
            <ConversationLiveUpdates messageCount={messages.length} />
          </div>

          {canSend ? (
            <MessageComposer bookingId={booking.id} />
          ) : (
            <div className="border-t border-border bg-[#f4f5f3] p-5 text-sm leading-6 text-muted">
              This conversation is read-only because the booking is {booking.status}.
            </div>
          )}
        </section>

        <aside className="h-fit rounded-3xl border border-border bg-white p-6">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">Booking details</p>
          <dl className="mt-5 space-y-5">
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Service</dt>
              <dd className="mt-1 font-semibold text-foreground">{booking.serviceName}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Requested time</dt>
              <dd className="mt-1 font-semibold leading-6 text-foreground">
                {formatBookingDate(booking.requestedDate, booking.requestedStartTime)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Location</dt>
              <dd className="mt-1 font-semibold leading-6 text-foreground">{booking.serviceLocation}</dd>
            </div>
          </dl>
          <p className="mt-6 rounded-2xl bg-background p-4 text-xs leading-5 text-muted">
            Keep sensitive payment or identity information out of messages. Auxilium never asks for passwords here.
          </p>
        </aside>
      </div>
    </DashboardShell>
  );
}
