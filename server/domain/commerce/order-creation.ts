import { COMMERCE_INVALID_INPUT } from "@/server/domain/commerce/contracts";

const MAX_EMAIL_LENGTH = 254;
const MAX_EMAIL_LOCAL_LENGTH = 64;
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeCommerceCustomerEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(COMMERCE_INVALID_INPUT);
  }

  const email = value.trim().toLowerCase();
  if (
    !email ||
    email.length > MAX_EMAIL_LENGTH ||
    /[\r\n\0]/.test(email) ||
    !EMAIL_SHAPE.test(email)
  ) {
    throw new Error(COMMERCE_INVALID_INPUT);
  }

  const at = email.lastIndexOf("@");
  if (at <= 0 || at > MAX_EMAIL_LOCAL_LENGTH || at === email.length - 1) {
    throw new Error(COMMERCE_INVALID_INPUT);
  }

  return email;
}


const CHECKOUT_REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeCommerceCheckoutRequestId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(COMMERCE_INVALID_INPUT);
  }
  const requestId = value.trim().toLowerCase();
  if (!CHECKOUT_REQUEST_ID.test(requestId)) {
    throw new Error(COMMERCE_INVALID_INPUT);
  }
  return requestId;
}
