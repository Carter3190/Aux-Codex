"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  registerProviderCredential,
  registerProviderPhoto,
  removeProviderUpload,
} from "@/lib/providers/actions";
import { labelFromSnakeCase } from "@/lib/providers/presentation";
import type {
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

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-white px-4 py-3 text-foreground outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function UploadMessage({ state }: { state: ProviderActionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
        state.status === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-[#b9d8c9] bg-[#eef8f2] text-brand-dark"
      }`}
    >
      {state.message}
    </p>
  );
}

export function ProviderUploadManager({
  providerId,
  photos,
  credentials,
}: {
  providerId: string;
  photos: ProviderPhoto[];
  credentials: CredentialSummary[];
}) {
  const router = useRouter();
  const [photoState, setPhotoState] = useState<ProviderActionState>({});
  const [credentialState, setCredentialState] = useState<ProviderActionState>({});
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
    <div className="grid gap-8 xl:grid-cols-2">
      <div>
        <h3 className="text-lg font-semibold text-brand-dark">Profile photos</h3>
        <p className="mt-1 text-sm leading-6 text-muted">
          Add a clear headshot or examples of completed work. JPG, PNG, or WebP;
          5 MB maximum.
        </p>
        {photos.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="overflow-hidden rounded-2xl border border-border bg-white">
                <div
                  className="aspect-[4/3] bg-cover bg-center"
                  style={{ backgroundImage: `url(${photo.publicUrl})` }}
                  role="img"
                  aria-label={photo.caption || "Provider photo"}
                />
                <div className="flex items-center justify-between gap-2 p-3">
                  <p className="truncate text-xs text-muted">
                    {photo.caption || "Provider photo"}
                  </p>
                  <form action={removeProviderUpload}>
                    <input type="hidden" name="uploadId" value={photo.id} />
                    <input type="hidden" name="kind" value="photo" />
                    <button type="submit" className="text-xs font-semibold text-red-700">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handlePhoto} className="mt-4 space-y-4 rounded-2xl bg-[#f4f7f4] p-5">
          <label className="block text-sm font-semibold text-foreground">
            Photo
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              className={`${inputClass} file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white`}
            />
          </label>
          <label className="block text-sm font-semibold text-foreground">
            Caption
            <input
              name="caption"
              maxLength={160}
              className={inputClass}
              placeholder="Custom built-in shelving"
            />
          </label>
          <UploadMessage state={photoState} />
          <button
            type="submit"
            disabled={uploading !== null}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {uploading === "photo" ? "Uploading…" : "Add photo"}
          </button>
        </form>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-brand-dark">Credentials</h3>
        <p className="mt-1 text-sm leading-6 text-muted">
          Credential files are private and visible only to you and Auxilium admins.
        </p>
        {credentials.length > 0 && (
          <div className="mt-4 space-y-3">
            {credentials.map((credential) => (
              <div key={credential.id} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-dark">{credential.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {labelFromSnakeCase(credential.credentialType)}
                      {credential.issuer ? ` · ${credential.issuer}` : ""}
                      {credential.expiresOn ? ` · Expires ${credential.expiresOn}` : ""}
                    </p>
                    <span className="mt-2 inline-flex rounded-full bg-[#f4f0e7] px-2.5 py-1 text-xs font-semibold capitalize text-[#76531c]">
                      {credential.reviewStatus}
                    </span>
                    {credential.reviewNotes && (
                      <p className="mt-2 text-xs leading-5 text-red-700">
                        {credential.reviewNotes}
                      </p>
                    )}
                  </div>
                  <form action={removeProviderUpload}>
                    <input type="hidden" name="uploadId" value={credential.id} />
                    <input type="hidden" name="kind" value="credential" />
                    <button type="submit" className="text-xs font-semibold text-red-700">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleCredential} className="mt-4 space-y-4 rounded-2xl bg-[#f4f7f4] p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-foreground">
              Credential type
              <select name="credentialType" className={inputClass} defaultValue="license">
                <option value="license">License</option>
                <option value="insurance">Insurance</option>
                <option value="certification">Certification</option>
                <option value="identity">Identity document</option>
                <option value="background_check">Background check</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-foreground">
              Title
              <input name="title" required maxLength={120} className={inputClass} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-foreground">
              Issuer <span className="font-normal text-muted">(optional)</span>
              <input name="issuer" maxLength={120} className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-foreground">
              Credential number <span className="font-normal text-muted">(optional)</span>
              <input name="credentialNumber" maxLength={120} className={inputClass} />
            </label>
          </div>
          <label className="block text-sm font-semibold text-foreground">
            Expiration date <span className="font-normal text-muted">(optional)</span>
            <input name="expiresOn" type="date" className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-foreground">
            Document
            <input
              name="document"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              required
              className={`${inputClass} file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white`}
            />
          </label>
          <UploadMessage state={credentialState} />
          <button
            type="submit"
            disabled={uploading !== null}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {uploading === "credential" ? "Uploading…" : "Add credential"}
          </button>
        </form>
      </div>
    </div>
  );
}
