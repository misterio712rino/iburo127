import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  getCaseDocument,
  getOrCreateCaseDocumentForClient,
  listCaseDocuments,
  markCaseDocumentReviewed,
  regenerateCaseDocument,
  sendCaseDocumentForReview,
} from "@/server/documents/operations";
import {
  parseDocumentClientCaseId,
  parseDocumentCode,
  parseDocumentMutationInput,
} from "@/server/documents/input";
import { executeDocumentOperation } from "@/server/documents/transport";

export function handleListCaseDocuments(sessionProvider: SessionProvider, clientCaseId: unknown) {
  return executeDocumentOperation(() =>
    listCaseDocuments(sessionProvider, parseDocumentClientCaseId(clientCaseId)),
  );
}

export function handleGetCaseDocument(
  sessionProvider: SessionProvider,
  clientCaseId: unknown,
  documentCode: unknown,
) {
  return executeDocumentOperation(() =>
    getCaseDocument(
      sessionProvider,
      parseDocumentClientCaseId(clientCaseId),
      parseDocumentCode(documentCode),
    ),
  );
}

export function handleGetOrCreateCaseDocument(
  sessionProvider: SessionProvider,
  clientCaseId: unknown,
  documentCode: unknown,
) {
  return executeDocumentOperation(() =>
    getOrCreateCaseDocumentForClient(
      sessionProvider,
      parseDocumentClientCaseId(clientCaseId),
      parseDocumentCode(documentCode),
    ),
  );
}

export function handleRegenerateCaseDocument(sessionProvider: SessionProvider, input: unknown) {
  return executeDocumentOperation(() =>
    regenerateCaseDocument(sessionProvider, parseDocumentMutationInput(input)),
  );
}

export function handleSendCaseDocumentForReview(sessionProvider: SessionProvider, input: unknown) {
  return executeDocumentOperation(() =>
    sendCaseDocumentForReview(sessionProvider, parseDocumentMutationInput(input)),
  );
}

export function handleMarkCaseDocumentReviewed(sessionProvider: SessionProvider, input: unknown) {
  return executeDocumentOperation(() =>
    markCaseDocumentReviewed(sessionProvider, parseDocumentMutationInput(input)),
  );
}
