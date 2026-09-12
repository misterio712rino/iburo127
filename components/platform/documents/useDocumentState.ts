"use client";

import { useSyncExternalStore } from "react";
import { documentWorkflowService } from "@/lib/platform/workflows/documents/documentWorkflowService";
import type { ClientDocumentState } from "@/lib/platform/types";

export function useDocumentState(identityId: string) {
  const serialized = useSyncExternalStore(
    documentWorkflowService.subscribe,
    () => JSON.stringify(documentWorkflowService.read(identityId)),
    () => documentWorkflowService.getServerSnapshot(identityId),
  );
  const state = JSON.parse(serialized) as ClientDocumentState;

  return {
    state,
    regenerate: (id: string) => documentWorkflowService.regenerate(identityId, state, id),
    sendForReview: (id: string) => documentWorkflowService.sendForReview(identityId, state, id),
    markReviewed: (id: string) => documentWorkflowService.markReviewed(identityId, state, id),
  };
}
