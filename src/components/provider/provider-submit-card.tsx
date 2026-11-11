"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitProviderApplication } from "@/lib/providers/actions";
import { LEGAL_AGREEMENTS } from "@/lib/legal/agreements";
import {
  initialProviderActionState,
  type ProviderCompletion,
  type ProviderStatus,
} from "@/lib/providers/types";
import { FormFeedback } from "./form-feedback";
import styles from "./provider-forms.module.css";

export function ProviderSubmitCard({
  completion,
  submittedAt,
  providerStatus,
}: {
  completion: ProviderCompletion;
  submittedAt: string | null;
  providerStatus?: ProviderStatus;
}) {
  const [state, action, pending] = useActionState(
    submitProviderApplication,
    initialProviderActionState,
  );

  return (
    <form action={action} className={styles.submit}>
      <p className={styles.kicker}>
        Final step
      </p>
      <h2>
        {providerStatus === "approved" ? "Application approved" : providerStatus === "suspended" ? "Account assistance needed" : providerStatus === "rejected" ? "Your application needs changes" : submittedAt ? "Application submitted" : "Submit for Auxilium review"}
      </h2>
      <p className={styles.description}>
        {providerStatus === "approved"
          ? "Your application was approved. Profile and credential changes may require another review."
          : providerStatus === "suspended"
            ? "Contact Auxilium support before making further changes to your account."
          : providerStatus === "rejected"
            ? "Review the feedback and update your profile before submitting it again."
          : submittedAt
          ? `Submitted ${new Date(submittedAt).toLocaleDateString()}. Editing any profile section will return the application to draft review.`
          : completion.isComplete
            ? "Every required section is complete. Submit your information for an administrator to review."
            : `Complete all ${completion.totalCount} required sections first. You have finished ${completion.completedCount} of ${completion.totalCount}.`}
      </p>
      <div className={styles.stack}>
        <FormFeedback state={state} />
      </div>
      {!submittedAt && providerStatus !== "approved" && providerStatus !== "suspended" && (
        <label className={styles.check}>
          <input
            type="checkbox"
            name="providerLegalConfirmation"
            value="accepted"
            required
          />
          <span>
            I have reviewed and agree to the current{" "}
            <Link
              href="/provider-agreement"
              target="_blank"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Provider Agreement
            </Link>{" "}
            (version {LEGAL_AGREEMENTS.providerAgreement.version}) and{" "}
            <Link
              href="/provider-standards"
              target="_blank"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Provider Standards
            </Link>{" "}
            (version {LEGAL_AGREEMENTS.providerStandards.version}). I accept
            responsibility for my services and for every employee,
            contractor, or subcontractor I send to a customer, and I confirm
            that all licenses, credentials, and insurance required for my
            services are current.
          </span>
        </label>
      )}
      <button
        type="submit"
        disabled={pending || !completion.isComplete || Boolean(submittedAt) || providerStatus === "approved" || providerStatus === "suspended"}
        className={styles.primary}
      >
        {pending ? "Submitting…" : providerStatus === "approved" ? "Approved" : providerStatus === "suspended" ? "Submission unavailable" : providerStatus === "rejected" ? "Resubmit application" : submittedAt ? "Under review" : "Submit application"}
      </button>
      {providerStatus === "suspended" && <Link href="/support" className={styles.secondary}>Contact support</Link>}
      {providerStatus === "rejected" && <Link href="/dashboard/provider/onboarding" className={styles.secondary}>Update profile</Link>}
    </form>
  );
}
