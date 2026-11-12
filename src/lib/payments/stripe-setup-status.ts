export type StripeSetupStatus =
  | "not_started"
  | "incomplete"
  | "pending"
  | "action_required"
  | "ready"
  | "unknown"
  | "unavailable";

type StripeAccountStatus = {
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  capabilities?: { card_payments?: string; transfers?: string } | null;
  requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
    pending_verification?: string[] | null;
    disabled_reason?: string | null;
    errors?: unknown[] | null;
  } | null;
};

// A return URL only means the provider left Stripe. Readiness and review state
// must come from the account retrieved from Stripe, never from that redirect.
export function stripeSetupStatus(account: StripeAccountStatus) {
  const requirements = account.requirements;
  const requirementsDueCount = new Set([
    ...(requirements?.currently_due ?? []),
    ...(requirements?.past_due ?? []),
  ]).size;
  const pendingVerificationCount = new Set(requirements?.pending_verification ?? []).size;
  const disabledReason = requirements?.disabled_reason;
  const reviewDisabled = disabledReason === "requirements.pending_verification" || disabledReason === "under_review";
  const blockingAction = Boolean(requirements?.past_due?.length) || Boolean(requirements?.errors?.length) || Boolean(disabledReason && !reviewDisabled);
  const actionRequired = requirementsDueCount > 0 || blockingAction;
  const ready = Boolean(account.details_submitted && account.charges_enabled && account.payouts_enabled);
  const pending = pendingVerificationCount > 0 || reviewDisabled ||
    account.capabilities?.card_payments === "pending" || account.capabilities?.transfers === "pending";

  let status: StripeSetupStatus;
  if (blockingAction) status = "action_required";
  else if (!account.details_submitted) status = "incomplete";
  else if (actionRequired) status = "action_required";
  else if (ready) status = "ready";
  else if (pending) status = "pending";
  else status = "incomplete";

  return { status, ready, requirementsDueCount, pendingVerificationCount };
}

export const stripeSetupLabels: Record<StripeSetupStatus, string> = {
  not_started: "Setup not started",
  incomplete: "Setup incomplete",
  pending: "Review pending",
  action_required: "Action needed",
  ready: "Payments ready",
  unknown: "Status unavailable",
  unavailable: "Temporarily unavailable",
};

export function providerStripeStatus(setup: {
  configured: boolean;
  migrationInstalled: boolean;
  hasAccount: boolean;
  detailsSubmitted: boolean;
  requirementsDueCount: number;
  ready: boolean;
  status?: StripeSetupStatus;
  statusFresh?: boolean;
}): StripeSetupStatus {
  if (!setup.configured || !setup.migrationInstalled) return "unavailable";
  if (setup.hasAccount && setup.statusFresh === false) return "unknown";
  if (setup.status) return setup.status;
  if (!setup.hasAccount) return "not_started";
  if (setup.requirementsDueCount > 0) return "action_required";
  if (setup.ready) return "ready";
  return setup.detailsSubmitted ? "unknown" : "incomplete";
}
