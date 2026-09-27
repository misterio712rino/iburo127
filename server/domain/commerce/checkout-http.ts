import {
  COMMERCE_INVALID_INPUT,
  COMMERCE_ONLINE_PLAN_CODES,
  type CommerceOnlinePlanCode,
} from "@/server/domain/commerce/contracts";
import {
  normalizeCommerceCheckoutRequestId,
  normalizeCommerceCustomerEmail,
} from "@/server/domain/commerce/order-creation";

export type CommerceCheckoutRequest = {
  planCode: CommerceOnlinePlanCode;
  email: string;
  requestId: string;
};

function invalid(): never {
  throw new Error(COMMERCE_INVALID_INPUT);
}

export function parseCommerceCheckoutBody(value: unknown): CommerceCheckoutRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "email" ||
    keys[1] !== "planCode" ||
    keys[2] !== "requestId"
  ) {
    invalid();
  }

  const planCode = record.planCode;
  if (
    typeof planCode !== "string" ||
    !COMMERCE_ONLINE_PLAN_CODES.includes(planCode as CommerceOnlinePlanCode)
  ) {
    invalid();
  }

  return {
    planCode: planCode as CommerceOnlinePlanCode,
    email: normalizeCommerceCustomerEmail(record.email),
    requestId: normalizeCommerceCheckoutRequestId(record.requestId),
  };
}

export function isAllowedCommerceCheckoutOrigin(
  request: Pick<Request, "headers">,
  allowedOrigin: string,
) {
  const origin = request.headers.get("origin")?.trim();
  if (!origin || origin === "null" || origin !== allowedOrigin) return false;

  try {
    return new URL(origin).origin === allowedOrigin;
  } catch {
    return false;
  }
}

export function commerceCheckoutCorsHeaders(allowedOrigin: string): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "600");
  headers.set("Vary", "Origin");
  return headers;
}
