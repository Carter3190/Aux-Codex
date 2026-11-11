import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import { getConversationInbox } from "@/lib/marketplace/data";
import { labelFromSnakeCase } from "@/lib/providers/presentation";
import styles from "@/components/messages/messages.module.css";

export const metadata: Metadata = { title: "Messages" };

function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

export default async function MessagesPage() {
  const { profile, conversations } = await getConversationInbox();
  return (
    <DashboardShell profile={profile} eyebrow="Messages" title="Messages">
      <div className={styles.page}>
        {conversations.length > 0 ? (
          <section className={styles.inbox} aria-labelledby="conversation-heading">
            <div className={styles.inboxHeading}>
              <h2 id="conversation-heading">Your conversations</h2>
              <span>{conversations.length} {conversations.length === 1 ? "conversation" : "conversations"}</span>
            </div>
            {conversations.map((conversation) => {
              const activity = conversation.lastMessage?.createdAt ?? conversation.booking.createdAt;
              return (
                <Link key={conversation.booking.id} href={`/dashboard/messages/${conversation.booking.id}`} className={styles.inboxRow}>
                  <span className={styles.initials} aria-hidden="true">{initials(conversation.counterpartName)}</span>
                  <div className={styles.inboxCopy}>
                    <div className={styles.inboxTitle}>
                      <h3>{conversation.counterpartName}</h3>
                      <span className={`${styles.badge} ${styles[conversation.booking.status] ?? ""}`}>{labelFromSnakeCase(conversation.booking.status)}</span>
                    </div>
                    <p className={styles.service}>{conversation.booking.serviceName}</p>
                    <p className={styles.lastMessage}>{conversation.lastMessage?.body ?? "No messages yet. Open the conversation to say hello."}</p>
                  </div>
                  <div className={styles.inboxAction}>
                    <time dateTime={activity}>{formatActivityDate(activity)}</time>
                    <span className={styles.openConversation}>Open conversation <CustomerIcon name="arrow" /></span>
                  </div>
                </Link>
              );
            })}
          </section>
        ) : (
          <section className={styles.empty}>
            <h2>No conversations yet</h2>
            <p>A conversation becomes available when a customer sends a booking request.</p>
            {profile.role === "customer" && <Link href="/providers" className={styles.primaryButton}>Browse providers <CustomerIcon name="arrow" /></Link>}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
