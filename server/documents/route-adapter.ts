import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  handleGetCaseDocument,
  handleGetOrCreateCaseDocument,
  handleListCaseDocuments,
  handleMarkCaseDocumentReviewed,
  handleRegenerateCaseDocument,
  handleSendCaseDocumentForReview,
} from "@/server/documents/handlers";
import { toDocumentHttpResponse } from "@/server/documents/http";

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function withAuthoritativeDocumentIdentity(
  body: unknown,
  clientCaseId: unknown,
  documentCode: unknown,
): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  return {
    ...(body as Record<string, unknown>),
    clientCaseId,
    documentCode,
  };
}

export function createDocumentRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async list(clientCaseId: unknown): Promise<Response> {
      return toDocumentHttpResponse(
        await handleListCaseDocuments(sessionProvider, clientCaseId),
      );
    },

    async get(clientCaseId: unknown, documentCode: unknown): Promise<Response> {
      return toDocumentHttpResponse(
        await handleGetCaseDocument(sessionProvider, clientCaseId, documentCode),
      );
    },

    async getOrCreate(clientCaseId: unknown, documentCode: unknown): Promise<Response> {
      return toDocumentHttpResponse(
        await handleGetOrCreateCaseDocument(sessionProvider, clientCaseId, documentCode),
      );
    },

    async regenerate(
      clientCaseId: unknown,
      documentCode: unknown,
      request: Request,
    ): Promise<Response> {
      const body = withAuthoritativeDocumentIdentity(
        await readJsonBody(request),
        clientCaseId,
        documentCode,
      );
      return toDocumentHttpResponse(
        await handleRegenerateCaseDocument(sessionProvider, body),
      );
    },

    async sendForReview(
      clientCaseId: unknown,
      documentCode: unknown,
      request: Request,
    ): Promise<Response> {
      const body = withAuthoritativeDocumentIdentity(
        await readJsonBody(request),
        clientCaseId,
        documentCode,
      );
      return toDocumentHttpResponse(
        await handleSendCaseDocumentForReview(sessionProvider, body),
      );
    },

    async markReviewed(
      clientCaseId: unknown,
      documentCode: unknown,
      request: Request,
    ): Promise<Response> {
      const body = withAuthoritativeDocumentIdentity(
        await readJsonBody(request),
        clientCaseId,
        documentCode,
      );
      return toDocumentHttpResponse(
        await handleMarkCaseDocumentReviewed(sessionProvider, body),
      );
    },
  };
}
