import type { CaseActionState } from "@/lib/cases/types";

export function CaseFeedback({ state }: { state: CaseActionState }) {
  if (!state.message) return null;

  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${
        state.status === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-[#b9d8c9] bg-[#eef8f2] text-brand-dark"
      }`}
    >
      {state.message}
    </p>
  );
}
