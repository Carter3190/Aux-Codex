"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DateField, SelectField } from "@/components/ui/fields";
import styles from "./provider-forms.module.css";
import { useState, type FormEvent } from "react";
import {
  registerProviderCredential,
  registerProviderPhoto,
  removeProviderUpload,
} from "@/lib/providers/actions";
import { labelFromSnakeCase } from "@/lib/providers/presentation";
import type {
  CredentialType,
  ProviderActionState,
  ProviderCredential,
  ProviderPhoto,
} from "@/lib/providers/types";
import { createClient } from "@/lib/supabase/client";

type CredentialSummary = Pick<
  ProviderCredential,
  | "id"
  | "credentialType"
  | "title"
  | "issuer"
  | "expiresOn"
  | "reviewStatus"
  | "reviewNotes"
>;



const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function UploadMessage({ state }: { state: ProviderActionState }) {
  if (!state.message) return null;
  return <p role={state.status === "error" ? "alert" : "status"} className={`${styles.feedback} ${state.status === "error" ? styles.feedbackError : ""}`}>{state.message}</p>;
}

export function ProviderUploadManager({
  providerId,
  photos,
  credentials,
  section,
}: {
  providerId: string;
  photos: ProviderPhoto[];
  credentials: CredentialSummary[];
  section?: "photos" | "credentials";
}) {
  const router = useRouter();
  const [photoState, setPhotoState] = useState<ProviderActionState>({});
  const [credentialState, setCredentialState] = useState<ProviderActionState>({});
  const [credentialType, setCredentialType] =
    useState<CredentialType>("insurance");
  const [uploading, setUploading] = useState<"photo" | "credential" | null>(null);

  async function uploadFile(
    file: File,
    bucket: "provider-photos" | "provider-credentials",
    maximumBytes: number,
  ) {
    const extension = extensions[file.type];
    if (!extension) throw new Error("Choose a supported JPG, PNG, WebP, or PDF file.");
    if (file.size > maximumBytes) {
      throw new Error(
        maximumBytes === 5 * 1024 * 1024
          ? "Photos must be 5 MB or smaller."
          : "Credential files must be 10 MB or smaller.",
      );
    }

    const path = `${providerId}/${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw new Error("The file could not be uploaded. Please try again.");
    return { path, supabase };
  }

  async function handlePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const file = values.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      setPhotoState({ status: "error", message: "Choose a profile photo." });
      return;
    }

    setUploading("photo");
    setPhotoState({});
    let uploaded: Awaited<ReturnType<typeof uploadFile>> | null = null;
    try {
      uploaded = await uploadFile(file, "provider-photos", 5 * 1024 * 1024);
      const metadata = new FormData();
      metadata.set("storagePath", uploaded.path);
      metadata.set("caption", String(values.get("caption") ?? ""));
      const result = await registerProviderPhoto(metadata);
      setPhotoState(result);
      if (result.status === "error") {
        await uploaded.supabase.storage.from("provider-photos").remove([uploaded.path]);
      } else {
        form.reset();
        router.refresh();
      }
    } catch (error) {
      setPhotoState({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to upload photo.",
      });
    } finally {
      setUploading(null);
    }
  }

  async function handleCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const file = values.get("document");
    if (!(file instanceof File) || file.size === 0) {
      setCredentialState({ status: "error", message: "Choose a credential file." });
      return;
    }

    setUploading("credential");
    setCredentialState({});
    let uploaded: Awaited<ReturnType<typeof uploadFile>> | null = null;
    try {
      uploaded = await uploadFile(
        file,
        "provider-credentials",
        10 * 1024 * 1024,
      );
      values.delete("document");
      values.set("documentPath", uploaded.path);
      const result = await registerProviderCredential(values);
      setCredentialState(result);
      if (result.status === "error") {
        await uploaded.supabase
          .storage.from("provider-credentials")
          .remove([uploaded.path]);
      } else {
        form.reset();
        setCredentialType("insurance");
        router.refresh();
      }
    } catch (error) {
      setCredentialState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Unable to upload credential.",
      });
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className={styles.stack}>
      {section !== "credentials" && <div className={styles.columns}>
        <section className={styles.panel} aria-label="Your photo gallery">
          <h2>Your photos</h2>
          {photos.length > 0 ? <div className={styles.gallery}>
            {photos.map((photo) => <article key={photo.id} className={styles.photo}>
              <div className={styles.photoImage} style={{ backgroundImage: `url(${photo.publicUrl})` }} role="img" aria-label={photo.caption || "Provider photo"} />
              <div className={styles.photoDetails}>
                <p>{photo.caption || "Provider photo"}</p>
                <form action={removeProviderUpload}>
                  <input type="hidden" name="uploadId" value={photo.id} /><input type="hidden" name="kind" value="photo" />
                  <button type="submit" className={styles.remove}>Remove</button>
                </form>
              </div>
            </article>)}
          </div> : <p className={styles.empty}>Your profile photos and examples of completed work will appear here.</p>}
        </section>
        <form onSubmit={handlePhoto} className={styles.panel}>
          <h2>Add a photo</h2>
          <p className={styles.description}>JPG, PNG, or WebP · up to 5 MB per photo. You can add more than one photo.</p>
          <label className={styles.field}>Photo
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className={`${styles.input} ${styles.file}`} />
          </label>
          <label className={styles.field}>Caption
            <input name="caption" maxLength={160} className={styles.input} placeholder="Describe the photo" />
          </label>
          <UploadMessage state={photoState} />
          <div className={styles.actions}>
            <button type="submit" disabled={uploading !== null} className={styles.primary}>{uploading === "photo" ? "Uploading…" : "Add photo"}</button>
            <Link href="/dashboard/provider/onboarding?section=credentials" className={styles.secondary}>Continue to credentials</Link>
          </div>
        </form>
      </div>}
      {section !== "photos" && <>
        <p className={styles.description}>Auxilium checks the requirements for each service and service area. Keep required documents current and submit renewals before they expire.</p>
        {credentials.length > 0 && <section className={styles.stack} aria-label="Submitted credentials">
          {credentials.map((credential) => <article key={credential.id} className={styles.credential}>
            <div className={styles.credentialTop}>
              <div>
                <h3>{credential.title}</h3>
                <p>{labelFromSnakeCase(credential.credentialType)}{credential.issuer ? ` · ${credential.issuer}` : ""}{credential.expiresOn ? ` · Expires ${credential.expiresOn}` : ""}</p>
                <span className={styles.badge}>{labelFromSnakeCase(credential.reviewStatus)}</span>
                {credential.reviewNotes && <p className={styles.reviewNote}>{credential.reviewNotes}</p>}
              </div>
              <form action={removeProviderUpload}>
                <input type="hidden" name="uploadId" value={credential.id} /><input type="hidden" name="kind" value="credential" />
                <button type="submit" className={styles.remove}>Remove</button>
              </form>
            </div>
          </article>)}
        </section>}
        <form onSubmit={handleCredential} className={styles.panel}>
          <h2>Add a credential</h2>
          <div className={styles.columns}>
            <label className={styles.field}>Credential type
              <SelectField name="credentialType" value={credentialType} aria-label="Credential type" onChange={(event) => setCredentialType(event.target.value as CredentialType)}>
                <option value="license">License</option><option value="insurance">Insurance</option><option value="certification">Certification</option><option value="identity">Identity document</option><option value="background_check">Background check</option><option value="other">Other</option>
              </SelectField>
            </label>
            <label className={styles.field}>Title
              <input name="title" required maxLength={120} className={styles.input} placeholder="Name of this credential" />
            </label>
          </div>
          <div className={styles.columns}>
            <label className={styles.field}>Issuer or carrier {credentialType !== "insurance" && <span>(optional)</span>}
              <input name="issuer" required={credentialType === "insurance"} maxLength={120} className={styles.input} placeholder="Organization that issued the document" />
              {credentialState.fieldErrors?.issuer?.[0] && <span className={styles.error}>{credentialState.fieldErrors.issuer[0]}</span>}
              {credentialType === "insurance" && <span className={styles.hint}>Required for insurance.</span>}
            </label>
            <label className={styles.field}>Credential number <span>(optional)</span>
              <input name="credentialNumber" maxLength={120} className={styles.input} placeholder="Enter the credential number" />
            </label>
          </div>
          <div className={styles.columns}>
            <label className={styles.field}>Expiration date {credentialType !== "insurance" && <span>(optional)</span>}
              <DateField name="expiresOn" required={credentialType === "insurance"} aria-label="Credential expiration date" />
              {credentialState.fieldErrors?.expiresOn?.[0] && <span className={styles.error}>{credentialState.fieldErrors.expiresOn[0]}</span>}
              {credentialType === "insurance" && <span className={styles.hint}>Required for insurance.</span>}
            </label>
            <label className={styles.field}>Document
              <input name="document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className={`${styles.input} ${styles.file}`} />
              <span className={styles.hint}>PDF, JPG, PNG, or WebP · up to 10 MB.</span>
            </label>
          </div>
          <UploadMessage state={credentialState} />
          <div className={styles.actions}>
            <button type="submit" disabled={uploading !== null} className={styles.primary}>{uploading === "credential" ? "Uploading…" : "Add credential"}</button>
            <Link href="/dashboard/provider/onboarding?section=availability" className={styles.secondary}>Continue to availability</Link>
          </div>
        </form>
      </>}
    </div>
  );
}
