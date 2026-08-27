import "server-only";

import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { TASK_NOT_FOUND, TASK_VERSION_CONFLICT } from "@/server/domain/tasks/contracts";
import { TASK_FORBIDDEN, TASK_INVALID_STATUS } from "@/server/domain/tasks/service";
import { TASK_INVALID_INPUT } from "@/server/tasks/input";

export type TaskTransportErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "VERSION_CONFLICT"
  | "INTERNAL_ERROR";

export type TaskOperationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: TaskTransportErrorCode;
        status: 400 | 401 | 403 | 404 | 409 | 500;
      };
    };

export function classifyTaskError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case UNAUTHENTICATED:
      return { code: "UNAUTHENTICATED" as const, status: 401 as const };
    case TASK_FORBIDDEN:
      return { code: "FORBIDDEN" as const, status: 403 as const };
    case TASK_NOT_FOUND:
      return { code: "NOT_FOUND" as const, status: 404 as const };
    case TASK_INVALID_INPUT:
    case TASK_INVALID_STATUS:
      return { code: "INVALID_INPUT" as const, status: 400 as const };
    case TASK_VERSION_CONFLICT:
      return { code: "VERSION_CONFLICT" as const, status: 409 as const };
    default:
      return { code: "INTERNAL_ERROR" as const, status: 500 as const };
  }
}

export async function executeTaskOperation<T>(
  operation: () => Promise<T>,
): Promise<TaskOperationResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: classifyTaskError(error) };
  }
}
