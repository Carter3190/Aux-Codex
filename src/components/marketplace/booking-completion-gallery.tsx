"use client";

import { useRef, useState } from "react";
import type { BookingCompletionPhoto } from "@/lib/marketplace/completion-photos";
import styles from "./completion-photos.module.css";
import forms from "./booking-forms.module.css";

export function BookingCompletionGallery({ photos, error, perspective }: {
  photos: BookingCompletionPhoto[]; error?: string | null; perspective: "customer" | "provider" | "admin";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<BookingCompletionPhoto | null>(null);
  const [failed, setFailed] = useState(false);
  if (!photos.length && !error) return null;

  function open(photo: BookingCompletionPhoto) {
    setSelected(photo);
    setFailed(false);
    dialog.current?.showModal();
  }

  return <section className={styles.section} aria-label="Completed work photos">
    <header className={styles.heading}><div><h3>Completed work</h3><p>{perspective === "provider" ? "Photos shared with your customer." : perspective === "admin" ? "Private photos shared for this booking." : "Photos shared by your provider."}</p></div></header>
    {error && <p className={styles.error} role="status">{error}</p>}
    <div className={styles.grid}>{photos.map((photo, index) => <figure className={styles.item} key={photo.id}>
      <button type="button" className={styles.open} onClick={() => open(photo)} aria-label={`View completion photo ${index + 1}`}>
        {/* Auth-scoped, short-lived private Storage URLs are refreshed with the booking. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={`Completed work photo ${index + 1}`} className={styles.thumbnail} />
      </button><figcaption className={styles.caption}>Completion photo {index + 1}</figcaption>
    </figure>)}</div>
    <dialog ref={dialog} className={styles.dialog} aria-label="Completion photo" onClose={() => setSelected(null)}>
      <div className={styles.dialogHeading}><h4>Completed work</h4><button type="button" className={forms.secondary} onClick={() => dialog.current?.close()}>Close photo</button></div>
      {selected && (failed ? <p className={styles.error}>This photo could not be loaded. Refresh the booking to try again.</p> :
        // eslint-disable-next-line @next/next/no-img-element
        <img src={selected.url} alt="Completed work shared for this booking" onError={() => setFailed(true)} />)}
    </dialog>
  </section>;
}
