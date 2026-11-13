import type { ProviderActionState } from "@/lib/providers/types";
import { ActionFeedback } from "@/components/marketplace/action-feedback";

export function FormFeedback({ state, tone }: { state: ProviderActionState; tone?: "success" | "error" | "info" | "declined" }) {
  return <ActionFeedback state={state} tone={tone} />;
}
