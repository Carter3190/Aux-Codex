import type { ProviderActionState } from "@/lib/providers/types";
import styles from "./provider-forms.module.css";

export function FormFeedback({ state }: { state: ProviderActionState }) {
  if (!state.message) return null;
  return <p role={state.status === "error" ? "alert" : "status"} className={`${styles.feedback} ${state.status === "error" ? styles.feedbackError : ""}`}>{state.message}</p>;
}
