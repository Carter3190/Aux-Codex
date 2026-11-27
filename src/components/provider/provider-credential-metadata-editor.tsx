"use client";

import { useActionState } from "react";
import { DateField } from "@/components/ui/fields";
import { updateProviderCredentialMetadata } from "@/lib/providers/actions";
import { initialProviderActionState, type ProviderCredential } from "@/lib/providers/types";
import { FormFeedback } from "./form-feedback";
import styles from "./provider-forms.module.css";

type EditableCredential = Pick<ProviderCredential, "id" | "title" | "credentialType" | "issuer" | "credentialNumber" | "expiresOn">;

export function ProviderCredentialMetadataEditor({ credential }: { credential: EditableCredential }) {
  const [state, action, pending] = useActionState(updateProviderCredentialMetadata, initialProviderActionState);
  const requiresIssuer = credential.credentialType === "license" || credential.credentialType === "insurance";
  return <details>
    <summary className={styles.secondary}>Edit details</summary>
    <form action={action} data-unsaved-form className={styles.stack} aria-label={`Edit ${credential.title} details`}>
      <input type="hidden" name="credentialId" value={credential.id} />
      <p className={styles.description}>Changed details need a new document review. Services that use this document pause until Auxillium reviews it again.</p>
      <label className={styles.field}>Title
        <input name="title" defaultValue={credential.title} required minLength={2} maxLength={120} className={styles.input} />
        {state.fieldErrors?.title?.[0] && <span className={styles.error}>{state.fieldErrors.title[0]}</span>}
      </label>
      <div className={styles.columns}>
        <label className={styles.field}>Issuer or carrier {!requiresIssuer && <span>(optional)</span>}
          <input name="issuer" defaultValue={credential.issuer} required={requiresIssuer} maxLength={120} className={styles.input} placeholder="Organization that issued the document" />
          {state.fieldErrors?.issuer?.[0] && <span className={styles.error}>{state.fieldErrors.issuer[0]}</span>}
        </label>
        <label className={styles.field}>Credential number <span>(optional)</span>
          <input name="credentialNumber" defaultValue={credential.credentialNumber} maxLength={120} className={styles.input} />
          {state.fieldErrors?.credentialNumber?.[0] && <span className={styles.error}>{state.fieldErrors.credentialNumber[0]}</span>}
        </label>
      </div>
      <label className={styles.field}>Expiration date {credential.credentialType !== "insurance" && <span>(optional)</span>}
        <DateField name="expiresOn" defaultValue={credential.expiresOn ?? ""} required={credential.credentialType === "insurance"} aria-label="Credential expiration date" />
        {state.fieldErrors?.expiresOn?.[0] && <span className={styles.error}>{state.fieldErrors.expiresOn[0]}</span>}
      </label>
      <FormFeedback state={state} />
      <div className={styles.actions}><button type="submit" disabled={pending} className={styles.primary}>{pending ? "Saving…" : "Save credential details"}</button></div>
    </form>
  </details>;
}
