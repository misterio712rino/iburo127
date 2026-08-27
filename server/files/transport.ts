import "server-only";

import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { FILE_CASE_NOT_FOUND, FILE_NOT_FOUND } from "@/server/domain/files/service";
import { FILE_TRANSPORT_INVALID_INPUT } from "@/server/files/input";

export type StoredFileTransportRecord = {
  id: string;
  clientCaseId: string;
  uploadedById: string | null;
  storageProvider: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
  checksumSha256: string | null;
  createdAt: Date;
};

export type StoredFileOperationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: "UNAUTHENTICATED" | "NOT_FOUND" | "INVALID_INPUT" | "INTERNAL_ERROR";
        status: 400 | 401 | 404 | 500;
      };
    };

export function toStoredFileTransportRecord(file: {
  id: string;
  clientCaseId: string;
  uploadedById: string | null;
  storageProvider: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  checksumSha256: string | null;
  createdAt: Date;
}): StoredFileTransportRecord {
  return { ...file, sizeBytes: file.sizeBytes.toString() };
}

export async function executeStoredFileOperation<T>(
  operation: () => Promise<T>,
): Promise<StoredFileOperationResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === UNAUTHENTICATED) {
      return { ok: false, error: { code: "UNAUTHENTICATED", status: 401 } };
    }
    if (code === FILE_CASE_NOT_FOUND || code === FILE_NOT_FOUND) {
      return { ok: false, error: { code: "NOT_FOUND", status: 404 } };
    }
    if (code === FILE_TRANSPORT_INVALID_INPUT) {
      return { ok: false, error: { code: "INVALID_INPUT", status: 400 } };
    }
    return { ok: false, error: { code: "INTERNAL_ERROR", status: 500 } };
  }
}
