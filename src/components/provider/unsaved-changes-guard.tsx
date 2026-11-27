"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import type { ProviderActionState } from "@/lib/providers/types";
import { createUnsavedFormTracker, fingerprintFormEntries, leavesCurrentPage } from "./unsaved-form-state";
import styles from "./unsaved-changes-guard.module.css";

const savedEvent = "auxillium:provider-form-settled";

export function ProviderFormSaveMarker({ state }: { state: ProviderActionState }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (state.status !== "success" && state.status !== "error") return;
    const form = marker.current?.closest("form[data-unsaved-form]");
    form?.dispatchEvent(new CustomEvent(savedEvent, { bubbles: true, detail: { succeeded: state.status === "success" } }));
  }, [state]);
  return <span ref={marker} hidden aria-hidden="true" />;
}

function snapshotForm(form: HTMLFormElement) {
  // Custom fields submit hidden values. Also retain their visible, possibly
  // incomplete draft text so an invalid date or number still gets a warning.
  const visibleDrafts = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")]
    .filter((field) => !field.name.startsWith("$ACTION_") && field.type !== "hidden" &&
      !["submit", "button", "reset", "file"].includes(field.type) && field.getAttribute("aria-hidden") !== "true")
    .map((field) => `${field.type}:${field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type) ? String(field.checked) : field.value}`);
  return fingerprintFormEntries(new FormData(form).entries(), visibleDrafts);
}

export function UnsavedChangesGuard({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const allowUnload = useRef(false);
  const router = useRouter();
  const [destination, setDestination] = useState<string | null>(null);
  const headingId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    const tracker = createUnsavedFormTracker<HTMLFormElement>();
    const allowedResets = new Set<HTMLFormElement>();
    function forms() {
      const current = [...root!.querySelectorAll<HTMLFormElement>("form[data-unsaved-form]")];
      tracker.retain(new Set(current));
      for (const form of current) tracker.register(form, snapshotForm(form));
      return current;
    }
    function hasChanges() { return forms().some((form) => tracker.dirty(form, snapshotForm(form))); }
    function ownForm(event: Event) {
      const target = event.target;
      const form = target instanceof HTMLFormElement ? target : target instanceof Element ? target.closest("form[data-unsaved-form]") : null;
      return form instanceof HTMLFormElement && root!.contains(form) && form.matches("[data-unsaved-form]") ? form : null;
    }
    function onEdit(event: Event) { const form = ownForm(event); if (form) tracker.changed(form); }
    function onSubmit(event: Event) {
      const form = ownForm(event);
      if (form) { forms(); tracker.submitting(form, snapshotForm(form)); }
    }
    function onReset(event: Event) {
      const form = ownForm(event);
      if (!form) return;
      if (allowedResets.has(form)) return;
      // React may reset an action form before its result effect runs, even
      // when the action returned validation errors. Defer that reset instead
      // of allowing either native inputs or custom-field reset listeners to erase drafts.
      event.preventDefault();
      event.stopImmediatePropagation();
      forms();
      if (tracker.requestReset(form)) queueFormReset(form);
    }
    function queueFormReset(form: HTMLFormElement) {
      const expected = snapshotForm(form);
      queueMicrotask(() => {
        if (!root!.contains(form) || !tracker.mayReset(form)) return;
        if (snapshotForm(form) !== expected) { tracker.cancelReset(form); return; }
        allowedResets.add(form);
        try {
          // Outside the result effect, finish custom-field state resets before
          // measuring the new baseline. This never submits or uploads anything.
          flushSync(() => form.reset());
          tracker.reset(form, snapshotForm(form));
        } finally { allowedResets.delete(form); }
      });
    }
    function onSettled(event: Event) {
      const form = ownForm(event);
      if (!form || !(event instanceof CustomEvent)) return;
      if (tracker.settled(form, snapshotForm(form), event.detail?.succeeded === true)) queueFormReset(form);
    }
    function onClick(event: MouseEvent) {
      // Custom select/calendar choices can update a hidden input without a
      // native change event. Observe after their click handler has committed.
      queueMicrotask(() => {
        if (root!.isConnected) for (const form of forms()) tracker.interacted(form, snapshotForm(form));
      });
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || !leavesCurrentPage({ href: anchor.href, currentUrl: window.location.href,
        target: anchor.target, download: anchor.hasAttribute("download"), button: event.button,
        modified: event.ctrlKey || event.metaKey || event.shiftKey || event.altKey, defaultPrevented: event.defaultPrevented }) || !hasChanges()) return;
      event.preventDefault();
      event.stopPropagation();
      trigger.current = anchor;
      setDestination(anchor.href);
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (allowUnload.current) { allowUnload.current = false; return; }
      if (!hasChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    }
    forms();
    const observer = new MutationObserver(forms);
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener("input", onEdit, true);
    root.addEventListener("change", onEdit, true);
    root.addEventListener("submit", onSubmit, true);
    root.addEventListener("reset", onReset, true);
    root.addEventListener(savedEvent, onSettled);
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      observer.disconnect();
      root.removeEventListener("input", onEdit, true);
      root.removeEventListener("change", onEdit, true);
      root.removeEventListener("submit", onSubmit, true);
      root.removeEventListener("reset", onReset, true);
      root.removeEventListener(savedEvent, onSettled);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (destination) { dialog.current?.showModal(); stay.current?.focus(); }
  }, [destination]);

  function closePrompt() {
    dialog.current?.close();
    setDestination(null);
    trigger.current?.focus();
  }
  function discardAndContinue() {
    if (!destination) return;
    const target = new URL(destination);
    closePrompt();
    if (target.origin === window.location.origin) router.push(`${target.pathname}${target.search}${target.hash}`);
    else { allowUnload.current = true; window.location.assign(target.href); }
  }

  return <div ref={scope} className={styles.scope}>
    {children}
    <dialog ref={dialog} className={styles.dialog} role="alertdialog" aria-labelledby={headingId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); closePrompt(); }} onClose={() => setDestination(null)}>
      <h2 id={headingId}>You have unsaved changes</h2>
      <p id={descriptionId}>Save your changes before leaving, or discard them to continue.</p>
      <div className={styles.actions}>
        <button ref={stay} type="button" className={styles.stay} onClick={closePrompt}>Stay on page</button>
        <button type="button" className={styles.leave} onClick={discardAndContinue}>Discard changes and continue</button>
      </div>
    </dialog>
  </div>;
}
