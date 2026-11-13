import type { PaymentActionState } from "@/lib/payments/types";
import { ActionFeedback } from "@/components/marketplace/action-feedback";

export function PaymentFeedback({ state }: { state: PaymentActionState }) {
  return <ActionFeedback state={state} />;
}
