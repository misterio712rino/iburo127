import "server-only";

import { UNAUTHENTICATED } from "@/server/auth/runtime";
import {
  PRACTICUM_NOT_FOUND,
  PRACTICUM_VERSION_CONFLICT,
} from "@/server/domain/practicum/contracts";
import {
  PRACTICUM_CASE_NOT_FOUND,
  PRACTICUM_FORBIDDEN,
  PRACTICUM_INVALID_LESSON,
} from "@/server/domain/practicum/service";
import { PRACTICUM_INVALID_INPUT } from "@/server/practicum/input";

export type PracticumTransportErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "VERSION_CONFLICT"
  | "INTERNAL_ERROR";

export type PracticumOperationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: PracticumTransportErrorCode;
        status: 400 | 401 | 403 | 404 | 409 | 500;
      };
    };

export function classifyPracticumError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case UNAUTHENTICATED:
      return { code: "UNAUTHENTICATED" as const, status: 401 as const };
    case PRACTICUM_FORBIDDEN:
      return { code: "FORBIDDEN" as const, status: 403 as const };
    case PRACTICUM_CASE_NOT_FOUND:
    case PRACTICUM_NOT_FOUND:
      return { code: "NOT_FOUND" as const, status: 404 as const };
    case PRACTICUM_INVALID_INPUT:
    case PRACTICUM_INVALID_LESSON:
      return { code: "INVALID_INPUT" as const, status: 400 as const };
    case PRACTICUM_VERSION_CONFLICT:
      return { code: "VERSION_CONFLICT" as const, status: 409 as const };
    default:
      return { code: "INTERNAL_ERROR" as const, status: 500 as const };
  }
}

export async function executePracticumOperation<T>(
  operation: () => Promise<T>,
): Promise<PracticumOperationResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: classifyPracticumError(error) };
  }
}
