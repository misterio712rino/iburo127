import "server-only";

import type { SessionProvider } from "@/server/auth/contracts";
import { getStoredFile, listStoredFiles } from "@/server/files/operations";
import { parseStoredFileClientCaseId, parseStoredFileId } from "@/server/files/input";
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
