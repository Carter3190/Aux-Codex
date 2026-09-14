import type { Metadata } from "next";
import { AdminCaseDecisionForms } from "@/components/cases/admin-case-decision-forms";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAdminResolutionWorkspace } from "@/lib/cases/data";
import { labelFromSnakeCase } from "@/lib/providers/presentation";

export const metadata: Metadata = {
  title: "Resolution center",
};

const activeStatuses = new Set(["open", "provider_responded", "under_review"]);
const activeDisputeStatuses = new Set([
  "warning_needs_response",
  "warning_under_review",
  "needs_response",
  "under_review",
]);

function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdminCasesPage() {
  const { admin, cases, disputes } = await getAdminResolutionWorkspace();
  const activeCases = cases.filter((item) => activeStatuses.has(item.status));
  const activeDisputes = disputes.filter((item) =>
    activeDisputeStatuses.has(item.status),
  );

  return (
    <DashboardShell
      profile={admin}
      eyebrow="Admin dashboard"
      title="Resolution center"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-sm text-muted">Open requests</p>
          <p className="mt-2 text-3xl font-semibold text-brand-dark">
            {activeCases.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-sm text-muted">Card disputes needing attention</p>
          <p className="mt-2 text-3xl font-semibold text-brand-dark">
            {activeDisputes.length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <p className="text-sm text-muted">Total resolution history</p>
          <p className="mt-2 text-3xl font-semibold text-brand-dark">
            {cases.length}
          </p>
        </div>
      </div>

      <section className="mt-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
            Customer requests
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-brand-dark">
            Refund and cancellation review
          </h2>
        </div>

        {cases.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border bg-white p-8 text-center">
            <h3 className="text-xl font-semibold text-brand-dark">
              No resolution requests yet
            </h3>
            <p className="mt-2 text-muted">
              Paid-booking issues submitted by customers will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {cases.map((item) => {
              const remainingRefundCents =
                item.payment.amountCents - item.payment.refundedAmountCents;
              const isActive = activeStatuses.has(item.status);
              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-border bg-white"
                >
                  <header className="border-b border-border bg-[#f7f9f6] p-6 sm:p-7">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
                          {item.serviceName}
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold text-brand-dark">
                          {item.customerName} → {item.providerName}
                        </h3>
                        <p className="mt-2 text-sm text-muted">
                          Opened {formatDate(item.createdAt)} · Booking {labelFromSnakeCase(item.bookingStatus)}
                        </p>
                      </div>
                      <span className="w-fit rounded-full border border-border bg-white px-3 py-1.5 text-xs font-bold text-brand-dark">
                        {labelFromSnakeCase(item.status)}
                      </span>
                    </div>
                  </header>

                  <div className="space-y-6 p-6 sm:p-7">
                    <dl className="grid gap-4 rounded-2xl bg-background p-5 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                          Request type
                        </dt>
                        <dd className="mt-1 font-semibold text-foreground">
                          {labelFromSnakeCase(item.category)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                          Customer requested
                        </dt>
                        <dd className="mt-1 font-semibold text-foreground">
                          {formatMoney(item.requestedRefundCents)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                          Payment balance
                        </dt>
                        <dd className="mt-1 font-semibold text-foreground">
                          {formatMoney(remainingRefundCents)} refundable
                        </dd>
                      </div>
                    </dl>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                        Customer statement
                      </p>
                      <p className="mt-2 whitespace-pre-wrap leading-7 text-foreground">
                        {item.customerDetails}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                        Provider statement
                      </p>
                      <p className="mt-2 whitespace-pre-wrap leading-7 text-foreground">
                        {item.providerResponse || "The provider has not responded yet."}
                      </p>
                    </div>

                    {item.adminNotes && !isActive && (
                      <div className="rounded-2xl border border-border bg-[#f7f8f6] p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                          Final admin notes
                        </p>
                        <p className="mt-2 whitespace-pre-wrap leading-7 text-foreground">
                          {item.adminNotes}
                        </p>
                      </div>
                    )}

                    {isActive && (
                      <AdminCaseDecisionForms
                        caseId={item.id}
                        requestedRefundCents={item.requestedRefundCents}
                        remainingRefundCents={remainingRefundCents}
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand">
          Stripe alerts
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-semibold text-brand-dark">Card disputes</h2>
          <a
            href="https://dashboard.stripe.com/disputes"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-brand hover:text-brand-dark"
          >
            Open Stripe dispute center →
          </a>
        </div>
        <p className="mt-3 max-w-3xl leading-7 text-muted">
          Stripe remains the source of truth for evidence submission and final
          card-network decisions. Auxilium mirrors signed dispute events here so
          the affected booking is immediately identifiable.
        </p>

        {disputes.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border bg-white p-8 text-center">
            <h3 className="text-xl font-semibold text-brand-dark">
              No Stripe disputes recorded
            </h3>
            <p className="mt-2 text-muted">
              Signed dispute webhooks will populate this queue automatically.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {disputes.map((dispute) => (
              <article
                key={dispute.id}
                className="rounded-3xl border border-red-200 bg-white p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.12em] text-red-700">
                      {labelFromSnakeCase(dispute.reason)}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-brand-dark">
                      {dispute.serviceName}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {dispute.customerName} → {dispute.providerName}
                    </p>
                  </div>
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800">
                    {labelFromSnakeCase(dispute.status)}
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold text-brand-dark">
                  {formatMoney(dispute.amountCents, dispute.currency)}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Received {formatDate(dispute.createdAt)}
                  {dispute.evidenceDueAt
                    ? ` · Evidence due ${formatDate(dispute.evidenceDueAt)}`
                    : ""}
                </p>
                <p className="mt-2 text-xs text-muted">
                  Stripe reference: {dispute.stripeDisputeId} · {dispute.livemode ? "Live mode" : "Test mode"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
