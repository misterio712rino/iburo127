import "server-only";

import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { NOTIFICATION_NOT_FOUND } from "@/server/domain/notifications/contracts";
import { NOTIFICATION_TRANSPORT_INVALID_INPUT } from "@/server/notifications/input";

export type NotificationOperationResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: "UNAUTHENTICATED" | "NOT_FOUND" | "INVALID_INPUT" | "INTERNAL_ERROR";
        status: 400 | 401 | 404 | 500;
      };
    };

export async function executeNotificationOperation<T>(
  operation: () => Promise<T>,
): Promise<NotificationOperationResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === UNAUTHENTICATED) {
      return { ok: false, error: { code: "UNAUTHENTICATED", status: 401 } };
    }
    if (code === NOTIFICATION_NOT_FOUND) {
      return { ok: false, error: { code: "NOT_FOUND", status: 404 } };
    }
    if (code === NOTIFICATION_TRANSPORT_INVALID_INPUT) {
      return { ok: false, error: { code: "INVALID_INPUT", status: 400 } };
    }
    return { ok: false, error: { code: "INTERNAL_ERROR", status: 500 } };
  }
}
