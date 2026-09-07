import "server-only";

import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { ACTIVITY_CASE_NOT_FOUND } from "@/server/domain/activity/service";
import { ACTIVITY_INVALID_INPUT } from "@/server/activity/input";

export type ActivityOperationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: "UNAUTHENTICATED" | "NOT_FOUND" | "INVALID_INPUT" | "INTERNAL_ERROR";
        status: 400 | 401 | 404 | 500;
      };
    };

export async function executeActivityOperation<T>(
  operation: () => Promise<T>,
): Promise<ActivityOperationResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === UNAUTHENTICATED) {
      return { ok: false, error: { code: "UNAUTHENTICATED", status: 401 } };
    }
    if (code === ACTIVITY_CASE_NOT_FOUND) {
      return { ok: false, error: { code: "NOT_FOUND", status: 404 } };
    }
    if (code === ACTIVITY_INVALID_INPUT) {
      return { ok: false, error: { code: "INVALID_INPUT", status: 400 } };
    }
    return { ok: false, error: { code: "INTERNAL_ERROR", status: 500 } };
  }
}
