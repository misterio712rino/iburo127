import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { getCommerceCheckoutRecoveryService } from "@/server/commerce/checkout-recovery-runtime";
import {
  COMMERCE_CHECKOUT_RECOVERY_CONFLICT,
  COMMERCE_CHECKOUT_RECOVERY_FORBIDDEN,
  COMMERCE_CHECKOUT_RECOVERY_INVALID_INPUT,
  COMMERCE_CHECKOUT_RECOVERY_NOT_ELIGIBLE,
  COMMERCE_CHECKOUT_RECOVERY_ORDER_NOT_FOUND,
  COMMERCE_CHECKOUT_RECOVERY_SESSION_MISMATCH,
} from "@/server/domain/commerce/checkout-recovery-service";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse } from "@/server/http/private-json";

export async function POST(request: Request) {
  const bodyResult = await readBoundedJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const sessionProvider = createProductionSessionProvider();
    const actor = await getCurrentPlatformActor(sessionProvider);
    const result = await getCommerceCheckoutRecoveryService().attachExistingOpenSession(
      actor,
      bodyResult.value,
    );
    return privateJsonResponse({ ok: true, data: result });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const code = error.message;
    if (code === UNAUTHENTICATED) return privateJsonResponse({ ok: false, error: { code } }, 401);
    if (code === COMMERCE_CHECKOUT_RECOVERY_FORBIDDEN) {
      return privateJsonResponse({ ok: false, error: { code } }, 403);
    }
    if (code === COMMERCE_CHECKOUT_RECOVERY_INVALID_INPUT) {
      return privateJsonResponse({ ok: false, error: { code } }, 400);
    }
    if (code === COMMERCE_CHECKOUT_RECOVERY_ORDER_NOT_FOUND) {
      return privateJsonResponse({ ok: false, error: { code } }, 404);
    }
    if (
      code === COMMERCE_CHECKOUT_RECOVERY_NOT_ELIGIBLE ||
      code === COMMERCE_CHECKOUT_RECOVERY_CONFLICT ||
      code === COMMERCE_CHECKOUT_RECOVERY_SESSION_MISMATCH
    ) return privateJsonResponse({ ok: false, error: { code } }, 409);
    return privateJsonResponse({ ok: false, error: { code: "COMMERCE_CHECKOUT_RECOVERY_UNAVAILABLE" } }, 503);
  }
}
