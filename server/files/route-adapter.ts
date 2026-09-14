import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  handleCompleteStoredFileUpload,
  handleCreateStoredFileDownloadUrl,
  handleDeleteStoredFile,
  handleGetStoredFile,
  handleListStoredFiles,
  handlePrepareStoredFileUpload,
} from "@/server/files/handlers";
import { toStoredFileHttpResponse } from "@/server/files/http";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";

export function createStoredFileRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async list(clientCaseId: unknown): Promise<Response> {
      return toStoredFileHttpResponse(await handleListStoredFiles(sessionProvider, clientCaseId));
    },

    async get(fileId: unknown): Promise<Response> {
      return toStoredFileHttpResponse(await handleGetStoredFile(sessionProvider, fileId));
    },

    async delete(fileId: unknown): Promise<Response> {
      return toStoredFileHttpResponse(await handleDeleteStoredFile(sessionProvider, fileId));
    },

    async prepareUpload(clientCaseId: unknown, request: Request): Promise<Response> {
      const bodyResult = await readBoundedJsonBody(request);
      if (!bodyResult.ok) return bodyResult.response;
      return toStoredFileHttpResponse(
        await handlePrepareStoredFileUpload(sessionProvider, clientCaseId, bodyResult.value),
      );
    },

    async completeUpload(fileId: unknown): Promise<Response> {
      return toStoredFileHttpResponse(
        await handleCompleteStoredFileUpload(sessionProvider, fileId),
      );
    },

    async createDownloadUrl(fileId: unknown, expiresInSeconds?: unknown): Promise<Response> {
      return toStoredFileHttpResponse(
        await handleCreateStoredFileDownloadUrl(sessionProvider, { fileId, expiresInSeconds }),
      );
    },
  };
}
