import "server-only";

import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { DOCUMENT_NOT_FOUND, DOCUMENT_VERSION_CONFLICT } from "@/server/domain/documents/contracts";
import {
  DOCUMENT_CASE_NOT_FOUND,
  DOCUMENT_FORBIDDEN,
  DOCUMENT_INVALID_CODE,
  DOCUMENT_INVALID_TRANSITION,
} from "@/server/domain/documents/service";
import { DOCUMENT_INVALID_INPUT } from "@/server/documents/input";

export type DocumentTransportErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "INVALID_TRANSITION"
  | "VERSION_CONFLICT"
  | "INTERNAL_ERROR";

export type DocumentOperationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: DocumentTransportErrorCode;
        status: 400 | 401 | 403 | 404 | 409 | 500;
      };
    };

export function classifyDocumentError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case UNAUTHENTICATED:
      return { code: "UNAUTHENTICATED" as const, status: 401 as const };
    case DOCUMENT_FORBIDDEN:
      return { code: "FORBIDDEN" as const, status: 403 as const };
    case DOCUMENT_CASE_NOT_FOUND:
    case DOCUMENT_NOT_FOUND:
      return { code: "NOT_FOUND" as const, status: 404 as const };
    case DOCUMENT_INVALID_INPUT:
    case DOCUMENT_INVALID_CODE:
      return { code: "INVALID_INPUT" as const, status: 400 as const };
    case DOCUMENT_INVALID_TRANSITION:
      return { code: "INVALID_TRANSITION" as const, status: 409 as const };
    case DOCUMENT_VERSION_CONFLICT:
      return { code: "VERSION_CONFLICT" as const, status: 409 as const };
    default:
      return { code: "INTERNAL_ERROR" as const, status: 500 as const };
  }
}

export async function executeDocumentOperation<T>(
  operation: () => Promise<T>,
): Promise<DocumentOperationResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: classifyDocumentError(error) };
  }
}
