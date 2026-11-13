"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";
import { completeBooking } from "@/lib/marketplace/actions";
import { initialMarketplaceActionState } from "@/lib/marketplace/types";
import { createClient } from "@/lib/supabase/client";
import { COMPLETION_PHOTO_BUCKET, MAX_COMPLETION_PHOTOS, MAX_COMPLETION_PHOTO_BYTES, completionPhotoPath, isCompletionPhotoType } from "@/lib/marketplace/completion-photo-values";
import { CustomerIcon } from "@/components/dashboard/customer-icon";
import { ActionFeedback } from "./action-feedback";
import styles from "./booking-forms.module.css";
import photos from "./completion-photos.module.css";

type SelectedPhoto = { key: string; file: File; preview: string };

export function BookingCompletionForm({ bookingId, providerId, paymentReceived = false }: {
  bookingId: string; providerId: string; paymentReceived?: boolean;
}) {
  const [selected, setSelected] = useState<SelectedPhoto[]>([]);
  const selectedRef = useRef<SelectedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    selectedRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
  }, []);

  function updateSelected(next: SelectedPhoto[]) {
    selectedRef.current = next;
    setSelected(next);
  }

  const [state, action, pending] = useActionState(
    async (previous: typeof initialMarketplaceActionState, formData: FormData) => {
      const uploaded: string[] = [];
      let supabase: ReturnType<typeof createClient> | null = null;
      const removeUploads = async () => {
        if (!supabase || !uploaded.length) return;
        try { await supabase.storage.from(COMPLETION_PHOTO_BUCKET).remove(uploaded); } catch { /* The original completion result remains visible if cleanup is unavailable. */ }
      };
      try {
        supabase = createClient();
        if (selectedRef.current.length) {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error || user?.id !== providerId) throw new Error("Please sign in to your provider account again.");
          for (const photo of selectedRef.current) {
            const path = completionPhotoPath(providerId, bookingId, crypto.randomUUID(), photo.file.type);
            const { error: uploadError } = await supabase.storage.from(COMPLETION_PHOTO_BUCKET).upload(path, photo.file, {
              contentType: photo.file.type, upsert: false,
            });
            if (uploadError) throw new Error("A completion photo could not be uploaded. Please try again.");
            uploaded.push(path);
            formData.append("completionPhotoPaths", path);
          }
        }
        const result = await completeBooking(previous, formData);
        if (result.status === "error" && uploaded.length) {
          await removeUploads();
        }
        if (result.status === "success") {
          selectedRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
          updateSelected([]);
        }
        return result;
      } catch (error) {
        await removeUploads();
        return { status: "error" as const, message: error instanceof Error ? error.message : "Unable to complete the visit. Please try again." };
      }
    },
    initialMarketplaceActionState,
  );

  function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const next = [...selectedRef.current];
    const errors: string[] = [];
    for (const file of Array.from(event.target.files ?? [])) {
      if (!isCompletionPhotoType(file.type)) { errors.push("Choose JPG, PNG, or WebP photos."); continue; }
      if (file.size === 0 || file.size > MAX_COMPLETION_PHOTO_BYTES) { errors.push("Each photo must be between 1 byte and 5 MB."); continue; }
      if (next.length >= MAX_COMPLETION_PHOTOS) { errors.push("You can add up to 5 completion photos."); continue; }
      next.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) });
    }
    updateSelected(next);
    setPhotoError([...new Set(errors)].join(" ") || null);
    event.target.value = "";
  }

  function removePhoto(key: string) {
    if (pending) return;
    const removed = selectedRef.current.find((photo) => photo.key === key);
    if (removed) URL.revokeObjectURL(removed.preview);
    updateSelected(selectedRef.current.filter((photo) => photo.key !== key));
    setPhotoError(null);
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <div>
        <p className="font-semibold text-brand-dark">Mark the service complete once the work is finished.</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          {paymentReceived ? "Payment is already confirmed for this visit." : "The agreed price becomes due. The customer pays from their booking; marking complete does not charge them automatically."}
        </p>
      </div>
      <section className={photos.picker} aria-label="Optional completion photos">
        <div><h4>Completion photos <span>(optional)</span></h4><p className={styles.hint}>Share the finished work with your customer. Photos stay within this booking.</p></div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={pending} onChange={choosePhotos} hidden aria-label="Choose completion photos" />
        <div className={styles.actions}><button type="button" className={styles.secondary} disabled={pending || selected.length >= MAX_COMPLETION_PHOTOS} onClick={() => input.current?.click()}><CustomerIcon name="upload" />Add photos</button><span className={styles.hint}>JPG, PNG, or WebP · Up to 5 photos · 5 MB each</span></div>
        {selected.length > 0 && <div className={photos.grid}>{selected.map((photo, index) => <figure className={photos.item} key={photo.key}>
          {/* Local blob previews are never published to the provider's public profile. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt={`Selected completion photo ${index + 1}`} className={photos.thumbnail} />
          <figcaption className={photos.caption}>{photo.file.name}</figcaption>
          <button type="button" className={photos.remove} disabled={pending} onClick={() => removePhoto(photo.key)} aria-label={`Remove completion photo ${index + 1}`}>Remove</button>
        </figure>)}</div>}
        <p role="status" className={styles.hint}>{selected.length ? `${selected.length} of ${MAX_COMPLETION_PHOTOS} photos selected.` : "No photos selected."}</p>
        {photoError && <ActionFeedback state={{ status: "error", message: photoError }} />}
      </section>
      <ActionFeedback state={state} />
      <div className={styles.actions}><button
        type="submit"
        disabled={pending}
        className={styles.primary}
      >
        {pending ? "Saving completion…" : "Mark complete"}
      </button></div>
    </form>
  );
}
