import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  handleCreateStoredFileDownloadUrl,
  handleGetStoredFile,
  handleListStoredFiles,
} from "@/server/files/handlers";
import { toStoredFileHttpResponse } from "@/server/files/http";

export function createStoredFileRouteAdapter(sessionProvider: SessionProvider) {
  return {
    async list(clientCaseId: unknown): Promise<Response> {
      return toStoredFileHttpResponse(
        await handleListStoredFiles(sessionProvider, clientCaseId),
      );
    },

    async get(fileId: unknown): Promise<Response> {
      return toStoredFileHttpResponse(
        await handleGetStoredFile(sessionProvider, fileId),
      );
    },

    async createDownloadUrl(
      fileId: unknown,
      expiresInSeconds?: unknown,
    ): Promise<Response> {
      return toStoredFileHttpResponse(
        await handleCreateStoredFileDownloadUrl(sessionProvider, {
          fileId,
          expiresInSeconds,
        }),
      );
    },
  };
}
