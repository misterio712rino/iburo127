import {
  COMMERCE_INVALID_INPUT,
  COMMERCE_ONLINE_PLAN_CODES,
  COMMERCE_PAYMENT_AMOUNT_MISMATCH,
  COMMERCE_PAYMENT_CURRENCY_MISMATCH,
  COMMERCE_PAYMENT_IDENTITY_CONFLICT,
  COMMERCE_PLAN_UNAVAILABLE,
  COMMERCE_UNSUPPORTED_PLAN,
  type CommerceCatalogEntry,
  type CommerceCheckoutQuote,
  type CommerceOnlinePlanCode,
  type CommerceOrderSnapshot,
  type CommerceOrderStatus,
  type CommercePaymentEventKind,
  type CommercePaymentSnapshot,
  type CommercePaymentStatus,
  type CommercePaymentTransition,
  type CommercePricingCatalog,
  type VerifiedCommercePaymentEvent,
} from "@/server/domain/commerce/contracts";

const MAX_AMOUNT_MINOR = 2_000_000_000;
const MAX_IDENTIFIER_LENGTH = 200;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const CURRENCY = /^[A-Z]{3}$/;

function invalid(): never {
  throw new Error(COMMERCE_INVALID_INPUT);
}

function normalizeIdentifier(value: unknown) {
  if (typeof value !== "string") invalid();
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_IDENTIFIER_LENGTH || /[\r\n\0]/.test(normalized)) {
    invalid();
  }
  return normalized;
}

function normalizeCurrency(value: unknown) {
  if (typeof value !== "string") invalid();
  const currency = value.trim().toUpperCase();
  if (!CURRENCY.test(currency)) invalid();
  return currency;
}

function requireAmountMinor(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_AMOUNT_MINOR
  ) {
    invalid();
  }
  return value;
}

function requireOccurredAt(value: unknown) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) invalid();
  return value;
}

function normalizeCatalogEntry(
  expectedPlanCode: CommerceOnlinePlanCode,
  entry: CommerceCatalogEntry | undefined,
): CommerceCheckoutQuote {
  if (!entry || !entry.active || entry.planCode !== expectedPlanCode) {
    throw new Error(COMMERCE_PLAN_UNAVAILABLE);
  }

  const amountMinor = requireAmountMinor(entry.amountMinor);
  const currency = normalizeCurrency(entry.currency);
  const offerVersion = normalizeIdentifier(entry.offerVersion);

  return {
    planCode: expectedPlanCode,
    amountMinor,
    currency,
    offerVersion,
  };
}

export function resolveCommerceCheckoutQuote(
  planCode: unknown,
  catalog: CommercePricingCatalog,
): CommerceCheckoutQuote {
  if (
    typeof planCode !== "string" ||
    !COMMERCE_ONLINE_PLAN_CODES.includes(planCode as CommerceOnlinePlanCode)
  ) {
    throw new Error(COMMERCE_UNSUPPORTED_PLAN);
  }

  const code = planCode as CommerceOnlinePlanCode;
  return normalizeCatalogEntry(code, catalog[code]);
}

export function normalizeVerifiedCommercePaymentEvent(
  input: VerifiedCommercePaymentEvent,
): VerifiedCommercePaymentEvent {
  const rawBodySha256 =
    typeof input.rawBodySha256 === "string" ? input.rawBodySha256.trim().toLowerCase() : "";
  if (!SHA256_HEX.test(rawBodySha256)) invalid();

  return {
    provider: normalizeIdentifier(input.provider),
    eventId: normalizeIdentifier(input.eventId),
    paymentId: normalizeIdentifier(input.paymentId),
    publicCheckoutId: normalizeIdentifier(input.publicCheckoutId),
    kind: requirePaymentEventKind(input.kind),
    amountMinor: requireAmountMinor(input.amountMinor),
    currency: normalizeCurrency(input.currency),
    occurredAt: requireOccurredAt(input.occurredAt),
    rawBodySha256,
  };
}

function requirePaymentEventKind(value: unknown): CommercePaymentEventKind {
  if (
    value !== "SUCCEEDED" &&
    value !== "FAILED" &&
    value !== "CANCELLED" &&
    value !== "REFUNDED" &&
    value !== "CHARGEBACK"
  ) {
    invalid();
  }
  return value;
}

function eventPaymentStatus(kind: CommercePaymentEventKind): CommercePaymentStatus {
  return kind;
}

function paymentRank(status: CommercePaymentStatus) {
  switch (status) {
    case "PENDING":
      return 0;
    case "FAILED":
    case "CANCELLED":
      return 1;
    case "SUCCEEDED":
      return 2;
    case "REFUNDED":
      return 3;
    case "CHARGEBACK":
      return 4;
  }
}

function transitionPaymentStatus(
  current: CommercePaymentStatus,
  incoming: CommercePaymentStatus,
): CommercePaymentStatus {
  if (current === "CHARGEBACK") return current;
  if (current === "REFUNDED") {
    return incoming === "CHARGEBACK" ? incoming : current;
  }
  if (current === "SUCCEEDED") {
    return incoming === "REFUNDED" || incoming === "CHARGEBACK" ? incoming : current;
  }

  if (incoming === "PENDING") return current;
  return incoming;
}

function transitionOrderStatus(
  current: CommerceOrderStatus,
  paymentStatus: CommercePaymentStatus,
): CommerceOrderStatus {
  if (paymentStatus === "CHARGEBACK") return "CHARGEBACK";
  if (paymentStatus === "REFUNDED") return "REFUNDED";

  if (paymentStatus === "SUCCEEDED") {
    if (current === "PROVISIONED" || current === "PROVISIONING") return current;
    if (current === "REFUNDED" || current === "CHARGEBACK") return current;
    return "PAID";
  }

  if (current === "PAID" || current === "PROVISIONING" || current === "PROVISIONED") {
    return current;
  }
  if (current === "REFUNDED" || current === "CHARGEBACK") return current;
  if (paymentStatus === "CANCELLED") return "CANCELLED";
  if (paymentStatus === "FAILED") return "PAYMENT_FAILED";
  return current;
}

function assertEventMatchesOrder(
  order: CommerceOrderSnapshot,
  event: VerifiedCommercePaymentEvent,
) {
  if (order.publicCheckoutId !== event.publicCheckoutId) {
    throw new Error(COMMERCE_PAYMENT_IDENTITY_CONFLICT);
  }
  if (order.amountMinor !== event.amountMinor) {
    throw new Error(COMMERCE_PAYMENT_AMOUNT_MISMATCH);
  }
  if (order.currency !== event.currency) {
    throw new Error(COMMERCE_PAYMENT_CURRENCY_MISMATCH);
  }
}

function assertEventMatchesExistingPayment(
  payment: CommercePaymentSnapshot,
  event: VerifiedCommercePaymentEvent,
) {
  if (payment.provider !== event.provider || payment.paymentId !== event.paymentId) {
    throw new Error(COMMERCE_PAYMENT_IDENTITY_CONFLICT);
  }
  if (payment.amountMinor !== event.amountMinor) {
    throw new Error(COMMERCE_PAYMENT_AMOUNT_MISMATCH);
  }
  if (payment.currency !== event.currency) {
    throw new Error(COMMERCE_PAYMENT_CURRENCY_MISMATCH);
  }
}

export function applyVerifiedCommercePaymentEvent(input: {
  order: CommerceOrderSnapshot;
  payment: CommercePaymentSnapshot | null;
  event: VerifiedCommercePaymentEvent;
}): CommercePaymentTransition {
  const event = normalizeVerifiedCommercePaymentEvent(input.event);
  assertEventMatchesOrder(input.order, event);

  if (input.payment) {
    assertEventMatchesExistingPayment(input.payment, event);
  }

  const currentPaymentStatus = input.payment?.status ?? "PENDING";
  const currentOccurredAt = input.payment?.providerOccurredAt ?? null;
  const incomingStatus = eventPaymentStatus(event.kind);

  if (currentOccurredAt) {
    const incomingTime = event.occurredAt.getTime();
    const currentTime = currentOccurredAt.getTime();

    if (
      incomingTime < currentTime ||
      (incomingTime === currentTime &&
        paymentRank(incomingStatus) <= paymentRank(currentPaymentStatus))
    ) {
      return {
        applied: false,
        stale: true,
        paymentStatus: currentPaymentStatus,
        orderStatus: input.order.status,
        providerOccurredAt: currentOccurredAt,
        orderBecamePaid: false,
        shouldPauseProvisionedCase: false,
      };
    }
  }

  const paymentStatus = transitionPaymentStatus(currentPaymentStatus, incomingStatus);
  const orderStatus = transitionOrderStatus(input.order.status, paymentStatus);
  const applied =
    paymentStatus !== currentPaymentStatus ||
    orderStatus !== input.order.status ||
    currentOccurredAt === null ||
    event.occurredAt.getTime() > currentOccurredAt.getTime();

  return {
    applied,
    stale: false,
    paymentStatus,
    orderStatus,
    providerOccurredAt: applied ? event.occurredAt : currentOccurredAt,
    orderBecamePaid:
      orderStatus === "PAID" &&
      input.order.status !== "PAID" &&
      input.order.status !== "PROVISIONING" &&
      input.order.status !== "PROVISIONED",
    shouldPauseProvisionedCase:
      (paymentStatus === "REFUNDED" || paymentStatus === "CHARGEBACK") &&
      (input.order.status === "PROVISIONED" || input.order.status === "PROVISIONING"),
  };
}
