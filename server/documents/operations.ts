import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { requireServerActor } from "@/server/auth/runtime";
import { caseDocumentService } from "@/server/documents/runtime";

export async function listCaseDocuments(
  sessionProvider: SessionProvider,
  clientCaseId: string,
) {
  const actor = await requireServerActor(sessionProvider);
  return caseDocumentService.list(actor, clientCaseId);
}

export async function getCaseDocument(
  sessionProvider: SessionProvider,
  clientCaseId: string,
  documentCode: string,
) {
  const actor = await requireServerActor(sessionProvider);
  return caseDocumentService.get(actor, clientCaseId, documentCode);
}

export async function getOrCreateCaseDocumentForClient(
  sessionProvider: SessionProvider,
  clientCaseId: string,
  documentCode: string,
) {
  const actor = await requireServerActor(sessionProvider);
  return caseDocumentService.getOrCreateForClient(actor, clientCaseId, documentCode);
}

export async function regenerateCaseDocument(
  sessionProvider: SessionProvider,
  input: { clientCaseId: string; documentCode: string; expectedVersion?: number },
) {
  const actor = await requireServerActor(sessionProvider);
  return caseDocumentService.regenerate(actor, input);
}

export async function sendCaseDocumentForReview(
  sessionProvider: SessionProvider,
  input: { clientCaseId: string; documentCode: string; expectedVersion?: number },
) {
  const actor = await requireServerActor(sessionProvider);
  return caseDocumentService.sendForReview(actor, input);
}

export async function markCaseDocumentReviewed(
  sessionProvider: SessionProvider,
  input: { clientCaseId: string; documentCode: string; expectedVersion?: number },
) {
  const actor = await requireServerActor(sessionProvider);
  return caseDocumentService.markReviewed(actor, input);
}
