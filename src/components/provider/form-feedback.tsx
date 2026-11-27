import type { ProviderActionState } from "@/lib/providers/types";
import { ActionFeedback } from "@/components/marketplace/action-feedback";
import { ProviderFormSaveMarker } from "./unsaved-changes-guard";

export function FormFeedback({ state, tone }: { state: ProviderActionState; tone?: "success" | "error" | "info" | "declined" }) {
  return <><ProviderFormSaveMarker state={state} /><ActionFeedback state={state} tone={tone} /></>;
}
