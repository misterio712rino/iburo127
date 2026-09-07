import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import {
  completeStoredFileUpload,
  createStoredFileDownloadUrl,
  deleteStoredFile,
  getStoredFile,
  listStoredFiles,
  prepareStoredFileUpload,
} from "@/server/files/operations";
import {
  parsePrepareStoredFileUploadInput,
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
    const files = await listStoredFiles(sessionProvider, parseStoredFileClientCaseId(clientCaseId));
    return files.map(toStoredFileTransportRecord);
  });
}

export function handleGetStoredFile(sessionProvider: SessionProvider, fileId: unknown) {
  return executeStoredFileOperation(async () =>
    toStoredFileTransportRecord(await getStoredFile(sessionProvider, parseStoredFileId(fileId))),
  );
}

export function handlePrepareStoredFileUpload(
  sessionProvider: SessionProvider,
  clientCaseId: unknown,
  body: unknown,
) {
  return executeStoredFileOperation(() =>
    prepareStoredFileUpload(
      sessionProvider,
      parsePrepareStoredFileUploadInput(body, clientCaseId),
    ),
  );
}

export function handleCompleteStoredFileUpload(sessionProvider: SessionProvider, fileId: unknown) {
  return executeStoredFileOperation(async () =>
    toStoredFileTransportRecord(
      await completeStoredFileUpload(sessionProvider, parseStoredFileId(fileId)),
    ),
  );
}

export function handleDeleteStoredFile(sessionProvider: SessionProvider, fileId: unknown) {
  return executeStoredFileOperation(() =>
    deleteStoredFile(sessionProvider, parseStoredFileId(fileId)),
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
