type SnapshotEntry = [string, string | { name: string; size: number; type: string; lastModified: number }];

/** Compare only in memory. Never persist, log, or read file contents. */
export function fingerprintFormEntries(entries: Iterable<SnapshotEntry>, visibleDrafts: string[] = []) {
  const values = [...entries]
    .filter(([name]) => !name.startsWith("$ACTION_"))
    .map(([name, value]) => [name, typeof value === "string" ? value
      : value.name === "" && value.size === 0 ? null
        : [value.name, value.size, value.type, value.lastModified]]);
  return JSON.stringify([values, visibleDrafts]);
}

type Draft = { baseline: string; submitted: string | null; resetRequested: boolean; resetBlocked: boolean; editedAfterSubmit: boolean };

export function createUnsavedFormTracker<Key>() {
  const drafts = new Map<Key, Draft>();
  return {
    register(key: Key, snapshot: string) {
      if (!drafts.has(key)) drafts.set(key, { baseline: snapshot, submitted: null, resetRequested: false, resetBlocked: false, editedAfterSubmit: false });
    },
    retain(keys: Set<Key>) {
      for (const key of drafts.keys()) if (!keys.has(key)) drafts.delete(key);
    },
    changed(key: Key) {
      const draft = drafts.get(key);
      if (draft && draft.submitted !== null) draft.editedAfterSubmit = true;
    },
    interacted(key: Key, current: string) {
      const draft = drafts.get(key);
      if (draft && draft.submitted !== null && draft.submitted !== current) draft.editedAfterSubmit = true;
    },
    submitting(key: Key, snapshot: string) {
      const draft = drafts.get(key);
      if (draft) { draft.submitted = snapshot; draft.resetRequested = false; draft.resetBlocked = false; draft.editedAfterSubmit = false; }
    },
    requestReset(key: Key) {
      const draft = drafts.get(key);
      if (!draft) return false;
      draft.resetRequested = true;
      return draft.submitted === null && !draft.resetBlocked;
    },
    mayReset(key: Key) {
      const draft = drafts.get(key);
      return Boolean(draft && draft.submitted === null && !draft.resetBlocked);
    },
    cancelReset(key: Key) {
      const draft = drafts.get(key);
      if (draft) draft.resetBlocked = true;
    },
    reset(key: Key, current: string) {
      const draft = drafts.get(key);
      if (!draft) return;
      draft.baseline = current;
      draft.submitted = null;
      draft.resetRequested = false;
      draft.resetBlocked = false;
      draft.editedAfterSubmit = false;
    },
    settled(key: Key, current: string, succeeded: boolean) {
      const draft = drafts.get(key);
      if (!draft || draft.submitted === null) return false;
      if (succeeded) {
        draft.baseline = !draft.editedAfterSubmit ? current : draft.submitted;
      }
      draft.resetBlocked = !succeeded || (draft.editedAfterSubmit && current !== draft.submitted);
      draft.submitted = null;
      return succeeded && draft.resetRequested && !draft.resetBlocked;
    },
    dirty(key: Key, current: string) {
      const draft = drafts.get(key);
      return Boolean(draft && draft.baseline !== current);
    },
  };
}

export function leavesCurrentPage(input: {
  href: string; currentUrl: string; target?: string | null; download?: boolean;
  button?: number; modified?: boolean; defaultPrevented?: boolean;
}) {
  if (input.defaultPrevented || (input.button ?? 0) !== 0 || input.modified || input.download ||
      (input.target && input.target.toLowerCase() !== "_self")) return false;
  try {
    const current = new URL(input.currentUrl);
    const destination = new URL(input.href, current);
    if (!["http:", "https:"].includes(destination.protocol)) return false;
    return destination.origin !== current.origin || destination.pathname !== current.pathname || destination.search !== current.search;
  } catch { return false; }
}
