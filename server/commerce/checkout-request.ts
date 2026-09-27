import { COMMERCE_INVALID_INPUT } from "@/server/domain/commerce/contracts";

export type CommerceCheckoutRequest = {
  planCode: unknown;
  customerEmail: unknown;
};

function invalid(): never {
  throw new Error(COMMERCE_INVALID_INPUT);
}

export function parseCommerceCheckoutRequest(value: unknown): CommerceCheckoutRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== "customerEmail" ||
    keys[1] !== "planCode"
  ) {
    invalid();
  }

  return {
    planCode: record.planCode,
    customerEmail: record.customerEmail,
  };
}
