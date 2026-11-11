import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import { ConversationLiveUpdates } from "@/components/messages/conversation-live-updates";
import { MessageComposer } from "@/components/messages/message-composer";
import { getBookingConversation } from "@/lib/marketplace/data";
import { labelFromSnakeCase } from "@/lib/providers/presentation";
import styles from "@/components/messages/messages.module.css";

export const metadata: Metadata = { title: "Conversation" };

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default async function ConversationPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const parsedId = z.uuid().safeParse(bookingId);
  if (!parsedId.success) notFound();
  const conversation = await getBookingConversation(parsedId.data);
  if (!conversation) notFound();
  const { profile, booking, messages, counterpartName, canSend, perspective } = conversation;
  const requested = new Date(`${booking.requestedDate}T${booking.requestedStartTime.length === 5 ? `${booking.requestedStartTime}:00` : booking.requestedStartTime}`);
  const requestedDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(requested);
  const requestedTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(requested);
  const bookingHref = `/dashboard/${perspective}/bookings/${booking.id}`;

  return (
    <DashboardShell profile={profile} eyebrow="Messages" title={counterpartName} description={booking.serviceName}>
      <div className={styles.page}>
        <Link href="/dashboard/messages" className={styles.backButton}><CustomerIcon name="back" />Back to messages</Link>
        <div className={styles.threadGrid}>
          <section className={styles.thread} aria-labelledby="conversation-heading">
            <div className={styles.threadHeading}>
              <h2 id="conversation-heading">Conversation</h2>
              <span className={`${styles.badge} ${styles[booking.status] ?? ""}`}>{labelFromSnakeCase(booking.status)}</span>
            </div>
            <div className={styles.messageList} role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions">
              {messages.length === 0 ? (
                <div className={styles.threadEmpty}>
                  <h2>Start the conversation</h2>
                  <p>Ask a question or coordinate the next step for this booking.</p>
                </div>
              ) : messages.map((message) => {
                const isOwn = message.senderId === profile.id;
                const senderName = message.senderId === booking.customerId ? booking.customerName : booking.providerName;
                return (
                  <article key={message.id} className={`${styles.message} ${isOwn ? styles.own : ""}`} aria-label={isOwn ? "Sent message" : `Message from ${senderName}`}>
                    {!isOwn && <p className={styles.sender}>{senderName}</p>}
                    <p className={styles.messageBody}>{message.body}</p>
                    <time dateTime={message.createdAt} className={styles.messageTime}>{formatMessageTime(message.createdAt)}</time>
                  </article>
                );
              })}
              <ConversationLiveUpdates messageCount={messages.length} />
            </div>
            {canSend ? <MessageComposer bookingId={booking.id} /> : <p className={styles.readOnly}>This conversation is read-only because the booking is {booking.status}.</p>}
          </section>
          <aside className={styles.details} aria-labelledby="conversation-booking-details">
            <h2 id="conversation-booking-details">Booking details</h2>
            <dl className={styles.facts}>
              <div className={styles.fullFact}><dt>Service</dt><dd>{booking.serviceName}</dd></div>
              <div className={styles.fullFact}><dt>Date</dt><dd>{requestedDate}</dd></div>
              <div><dt>Time</dt><dd>{requestedTime}</dd></div>
              <div><dt>Status</dt><dd>{labelFromSnakeCase(booking.status)}</dd></div>
              <div className={styles.fullFact}><dt>Location</dt><dd>{booking.serviceLocation}</dd></div>
              <div className={styles.fullFact}><dt>Booking reference</dt><dd>{booking.id}</dd></div>
            </dl>
            <Link href={bookingHref} className={styles.secondaryButton}>View booking <CustomerIcon name="arrow" /></Link>
            <p className={styles.privacy}>Keep sensitive payment or identity information out of messages. Auxilium never asks for passwords here.</p>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
