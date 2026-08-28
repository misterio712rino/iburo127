import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  createStoredFileDownloadUrl,
  getStoredFile,
  listStoredFiles,
} from "@/server/files/operations";
import {
  parseStoredFileClientCaseId,
  parseStoredFileId,
  parseStoredFileSignedUrlTtl,
} from "@/server/files/input";
import {
  executeStoredFileOperation,
  toStoredFileTransportRecord,
} from "@/server/files/transport";

export function handleListStoredFiles(sessionProvider: SessionProvider, clientCaseId: unknown) {
  return executeStoredFileOperation(async () => {
    const files = await listStoredFiles(
      sessionProvider,
      parseStoredFileClientCaseId(clientCaseId),
    );
    return files.map(toStoredFileTransportRecord);
  });
}

export function handleGetStoredFile(sessionProvider: SessionProvider, fileId: unknown) {
  return executeStoredFileOperation(async () =>
    toStoredFileTransportRecord(
      await getStoredFile(sessionProvider, parseStoredFileId(fileId)),
    ),
  );
}

export function handleCreateStoredFileDownloadUrl(
  sessionProvider: SessionProvider,
  input: { fileId: unknown; expiresInSeconds?: unknown },
) {
  return executeStoredFileOperation(() =>
    createStoredFileDownloadUrl(
      sessionProvider,
      parseStoredFileId(input.fileId),
      parseStoredFileSignedUrlTtl(input.expiresInSeconds),
    ),
  );
}
