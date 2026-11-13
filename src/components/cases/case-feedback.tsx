import type { CaseActionState } from "@/lib/cases/types";
import { ActionFeedback } from "@/components/marketplace/action-feedback";

export function CaseFeedback({ state, tone }: { state: CaseActionState; tone?: "success" | "error" | "info" | "declined" }) {
  return <ActionFeedback state={state} tone={tone} />;
}
