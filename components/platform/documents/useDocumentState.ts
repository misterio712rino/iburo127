"use client";

import { useSyncExternalStore } from "react";
import {
  getDocumentServerSnapshot,
  persistDocumentState,
  readDocumentState,
  subscribeDocumentState,
} from "@/lib/platform/workflows/documents/demoDocumentAdapter";
import type { ClientDocumentState } from "@/lib/platform/types";

export function useDocumentState(identityId: string) {
  const serialized = useSyncExternalStore(
    subscribeDocumentState,
    () => JSON.stringify(readDocumentState(identityId)),
    () => getDocumentServerSnapshot(identityId),
  );
  const state = JSON.parse(serialized) as ClientDocumentState;

  return {
    state,
    regenerate: (id: string) => persistDocumentState(identityId, {
      ...state,
      regeneratedAtById: {
        ...state.regeneratedAtById,
        [id]: new Date().toISOString(),
      },
    }),
    sendForReview: (id: string) => persistDocumentState(identityId, {
      ...state,
      sentForReviewIds: state.sentForReviewIds.includes(id)
        ? state.sentForReviewIds
        : [...state.sentForReviewIds, id],
    }),
    markReviewed: (id: string) => persistDocumentState(identityId, {
      ...state,
      reviewedAtById: {
        ...state.reviewedAtById,
        [id]: new Date().toISOString(),
      },
    }),
  };
}
