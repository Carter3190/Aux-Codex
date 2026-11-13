import styles from "./booking-forms.module.css";

type FeedbackTone = "success" | "error" | "info" | "declined";

export function ActionFeedback({ state, tone, className = "" }: {
  state: { status?: "success" | "error"; message?: string };
  tone?: FeedbackTone;
  className?: string;
}) {
  if (!state.message) return null;
  const resolvedTone = state.status === "error" ? "error" : tone ?? (state.status === "success" ? "success" : "info");
  return (
    <div role={resolvedTone === "error" ? "alert" : "status"} className={`${styles.feedback} ${styles[resolvedTone]} ${className}`}>
      <span className={styles.feedbackMark} aria-hidden="true">{resolvedTone === "success" ? "✓" : resolvedTone === "declined" ? "×" : resolvedTone === "error" ? "!" : "i"}</span>
      <span>{state.message}</span>
    </div>
  );
}
