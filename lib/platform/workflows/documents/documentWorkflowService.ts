import {
  getDocumentServerSnapshot,
  persistDocumentState,
  readDocumentState,
  subscribeDocumentState,
} from "@/lib/platform/workflows/documents/demoDocumentAdapter";
import type { ClientDocumentState } from "@/lib/platform/types";

export interface DocumentWorkflowService {
  read(identityId: string): ClientDocumentState;
  getServerSnapshot(identityId: string): string;
  subscribe(callback: () => void): () => void;
  regenerate(identityId: string, state: ClientDocumentState, documentId: string): void;
  sendForReview(identityId: string, state: ClientDocumentState, documentId: string): void;
  markReviewed(identityId: string, state: ClientDocumentState, documentId: string): void;
}

class DemoDocumentWorkflowService implements DocumentWorkflowService {
  read(identityId: string) {
    return readDocumentState(identityId);
  }

  getServerSnapshot(identityId: string) {
    return getDocumentServerSnapshot(identityId);
  }

  subscribe(callback: () => void) {
    return subscribeDocumentState(callback);
  }

  regenerate(identityId: string, state: ClientDocumentState, documentId: string) {
    persistDocumentState(identityId, {
      ...state,
      regeneratedAtById: {
        ...state.regeneratedAtById,
        [documentId]: new Date().toISOString(),
      },
    });
  }

  sendForReview(identityId: string, state: ClientDocumentState, documentId: string) {
    persistDocumentState(identityId, {
      ...state,
      sentForReviewIds: state.sentForReviewIds.includes(documentId)
        ? state.sentForReviewIds
        : [...state.sentForReviewIds, documentId],
    });
  }

  markReviewed(identityId: string, state: ClientDocumentState, documentId: string) {
    persistDocumentState(identityId, {
      ...state,
      reviewedAtById: {
        ...state.reviewedAtById,
        [documentId]: new Date().toISOString(),
      },
    });
  }
}

export const documentWorkflowService: DocumentWorkflowService =
  new DemoDocumentWorkflowService();
