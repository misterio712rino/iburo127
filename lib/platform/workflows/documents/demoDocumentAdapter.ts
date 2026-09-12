import type { ClientDocumentState } from "@/lib/platform/types";

const STORAGE_PREFIX = "iburo.demo.documents.v1.";
const EVENT_NAME = "iburo-document-state";
const EMPTY_STATE: ClientDocumentState = {
  regeneratedAtById: {},
  sentForReviewIds: [],
  reviewedAtById: {},
};
const serverSnapshots = new Map<string, string>();

export function readDocumentState(identityId: string): ClientDocumentState {
  try {
    const value = window.localStorage.getItem(`${STORAGE_PREFIX}${identityId}`);
    if (!value) return EMPTY_STATE;

    const parsed = JSON.parse(value) as Partial<ClientDocumentState>;
    return {
      regeneratedAtById: parsed.regeneratedAtById ?? {},
      sentForReviewIds: parsed.sentForReviewIds ?? [],
      reviewedAtById: parsed.reviewedAtById ?? {},
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function subscribeDocumentState(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

export function getDocumentServerSnapshot(identityId: string) {
  const existing = serverSnapshots.get(identityId);
  if (existing) return existing;

  const value = JSON.stringify(EMPTY_STATE);
  serverSnapshots.set(identityId, value);
  return value;
}

export function persistDocumentState(identityId: string, state: ClientDocumentState) {
  window.localStorage.setItem(`${STORAGE_PREFIX}${identityId}`, JSON.stringify(state));
  window.dispatchEvent(new Event(EVENT_NAME));
}
