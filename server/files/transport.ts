import "server-only";

import { UNAUTHENTICATED } from "@/server/auth/runtime";
import {
  FILE_CASE_NOT_FOUND,
  FILE_NOT_FOUND,
  FILE_UPLOAD_FORBIDDEN,
  FILE_UPLOAD_NOT_PENDING,
} from "@/server/domain/files/service";
import { FILE_TRANSPORT_INVALID_INPUT } from "@/server/files/input";
import {
  FILE_STORAGE_PROVIDER_MISMATCH,
  FILE_UPLOAD_INCOMPLETE,
  FILE_UPLOAD_METADATA_MISMATCH,
} from "@/server/files/operations";

export type StoredFileTransportRecord = {
  id: string;
  clientCaseId: string;
  uploadedById: string | null;
  status: "PENDING_UPLOAD" | "READY";
  storageProvider: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
  checksumSha256: string | null;
  readyAt: Date | null;
  createdAt: Date;
};

export type StoredFileOperationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" | "CONFLICT" | "INTERNAL_ERROR";
        status: 400 | 401 | 403 | 404 | 409 | 500;
      };
    };

export function toStoredFileTransportRecord(file: {
  id: string;
  clientCaseId: string;
  uploadedById: string | null;
  status: "PENDING_UPLOAD" | "READY";
  storageProvider: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  checksumSha256: string | null;
  readyAt: Date | null;
  createdAt: Date;
}): StoredFileTransportRecord {
  return {
    id: file.id,
    clientCaseId: file.clientCaseId,
    uploadedById: file.uploadedById,
    status: file.status,
    storageProvider: file.storageProvider,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes.toString(),
    checksumSha256: file.checksumSha256,
    readyAt: file.readyAt,
    createdAt: file.createdAt,
  };
}

export async function executeStoredFileOperation<T>(operation: () => Promise<T>): Promise<StoredFileOperationResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === UNAUTHENTICATED) return { ok: false, error: { code: "UNAUTHENTICATED", status: 401 } };
    if (code === FILE_UPLOAD_FORBIDDEN) return { ok: false, error: { code: "FORBIDDEN", status: 403 } };
    if (code === FILE_CASE_NOT_FOUND || code === FILE_NOT_FOUND) return { ok: false, error: { code: "NOT_FOUND", status: 404 } };
    if (code === FILE_TRANSPORT_INVALID_INPUT || code === FILE_UPLOAD_METADATA_MISMATCH) return { ok: false, error: { code: "INVALID_INPUT", status: 400 } };
    if (code === FILE_UPLOAD_INCOMPLETE || code === FILE_UPLOAD_NOT_PENDING) return { ok: false, error: { code: "CONFLICT", status: 409 } };
    if (code === FILE_STORAGE_PROVIDER_MISMATCH) return { ok: false, error: { code: "INTERNAL_ERROR", status: 500 } };
    return { ok: false, error: { code: "INTERNAL_ERROR", status: 500 } };
  }
}
