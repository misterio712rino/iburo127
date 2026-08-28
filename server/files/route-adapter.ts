import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  handleCompleteStoredFileUpload,
  handleCreateStoredFileDownloadUrl,
  handleGetStoredFile,
  handleListStoredFiles,
  handlePrepareStoredFileUpload,
} from "@/server/files/handlers";
import { toStoredFileHttpResponse } from "@/server/files/http";

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function createStoredFileRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async list(clientCaseId: unknown): Promise<Response> {
      return toStoredFileHttpResponse(await handleListStoredFiles(sessionProvider, clientCaseId));
    },

    async get(fileId: unknown): Promise<Response> {
      return toStoredFileHttpResponse(await handleGetStoredFile(sessionProvider, fileId));
    },

    async prepareUpload(clientCaseId: unknown, request: Request): Promise<Response> {
      return toStoredFileHttpResponse(
        await handlePrepareStoredFileUpload(sessionProvider, clientCaseId, await readJsonBody(request)),
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
