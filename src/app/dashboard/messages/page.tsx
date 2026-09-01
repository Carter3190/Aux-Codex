import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getConversationInbox } from "@/lib/marketplace/data";
import { labelFromSnakeCase } from "@/lib/providers/presentation";

export const metadata: Metadata = {
  title: "Messages",
};

const statusTone = {
  pending: "bg-[#fff8e9] text-[#76531c]",
  accepted: "bg-[#eef8f2] text-brand-dark",
  declined: "bg-red-50 text-red-800",
  cancelled: "bg-[#f1f2f0] text-muted",
} as const;

function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function MessagesPage() {
  const { profile, conversations } = await getConversationInbox();

  return (
    <DashboardShell
      profile={profile}
      eyebrow="Messages"
      title="Your booking conversations"
    >
      <p className="-mt-5 mb-8 max-w-2xl leading-7 text-muted">
        Keep service details and next steps connected to the original booking request.
      </p>

      {conversations.length > 0 ? (
        <div className="overflow-hidden rounded-3xl border border-border bg-white">
          {conversations.map((conversation, index) => (
            <Link
              key={conversation.booking.id}
              href={`/dashboard/messages/${conversation.booking.id}`}
              className={`grid gap-4 p-6 transition hover:bg-[#f7faf7] sm:grid-cols-[1fr_auto] sm:items-center ${
                index > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="truncate text-xl font-semibold text-brand-dark">
                    {conversation.counterpartName}
                  </h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone[conversation.booking.status]}`}>
                    {labelFromSnakeCase(conversation.booking.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-brand">
                  {conversation.booking.serviceName}
                </p>
                <p className="mt-3 truncate text-muted">
                  {conversation.lastMessage
                    ? `${conversation.lastMessage.senderId === profile.id ? "You: " : ""}${conversation.lastMessage.body}`
                    : "No messages yet. Open the conversation to say hello."}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-muted">
                  {formatActivityDate(
                    conversation.lastMessage?.createdAt ?? conversation.booking.createdAt,
                  )}
                </p>
                <p className="mt-2 text-sm font-semibold text-brand">Open conversation →</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <section className="rounded-3xl border border-dashed border-border bg-white p-9 text-center">
          <h2 className="text-2xl font-semibold text-brand-dark">No conversations yet</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-muted">
            A conversation becomes available when a customer sends a booking request.
          </p>
          {profile.role === "customer" && (
            <Link
              href="/providers"
              className="mt-6 inline-flex rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark"
            >
              Browse providers
            </Link>
          )}
        </section>
      )}
    </DashboardShell>
  );
}
