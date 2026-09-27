export const COMMERCE_INVALID_INPUT = "COMMERCE_INVALID_INPUT";
export const COMMERCE_UNSUPPORTED_PLAN = "COMMERCE_UNSUPPORTED_PLAN";
export const COMMERCE_PLAN_UNAVAILABLE = "COMMERCE_PLAN_UNAVAILABLE";
export const COMMERCE_PAYMENT_AMOUNT_MISMATCH = "COMMERCE_PAYMENT_AMOUNT_MISMATCH";
export const COMMERCE_PAYMENT_CURRENCY_MISMATCH = "COMMERCE_PAYMENT_CURRENCY_MISMATCH";
export const COMMERCE_PAYMENT_IDENTITY_CONFLICT = "COMMERCE_PAYMENT_IDENTITY_CONFLICT";
export const COMMERCE_ORDER_NOT_FOUND = "COMMERCE_ORDER_NOT_FOUND";
export const COMMERCE_PAYMENT_EVENT_CONFLICT = "COMMERCE_PAYMENT_EVENT_CONFLICT";
export const COMMERCE_PAYMENT_CONCURRENT_UPDATE = "COMMERCE_PAYMENT_CONCURRENT_UPDATE";

export const COMMERCE_ONLINE_PLAN_CODES = ["LITE", "PRO"] as const;

export type CommerceOnlinePlanCode = (typeof COMMERCE_ONLINE_PLAN_CODES)[number];

export type CommerceOrderStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_FAILED"
  | "CANCELLED"
  | "PAID"
  | "PROVISIONING"
  | "PROVISIONED"
  | "REFUNDED"
  | "CHARGEBACK";

export type CommercePaymentStatus =
  | "PENDING"
  | "FAILED"
  | "CANCELLED"
  | "SUCCEEDED"
  | "REFUNDED"
  | "CHARGEBACK";

export type CommercePaymentEventKind =
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "CHARGEBACK";

export type CommercePaymentEventProcessingStatus =
  | "RECEIVED"
  | "APPLIED"
  | "IGNORED"
  | "REJECTED";

export type CommerceCatalogEntry = {
  planCode: CommerceOnlinePlanCode;
  amountMinor: number;
  currency: string;
  offerVersion: string;
  active: boolean;
};

export type CommercePricingCatalog = Readonly<
  Partial<Record<CommerceOnlinePlanCode, CommerceCatalogEntry>>
>;

export type CommerceCheckoutQuote = {
  planCode: CommerceOnlinePlanCode;
  amountMinor: number;
  currency: string;
  offerVersion: string;
};

export type CommerceOrderSnapshot = {
  publicCheckoutId: string;
  planCode: CommerceOnlinePlanCode;
  amountMinor: number;
  currency: string;
  status: CommerceOrderStatus;
};

export type CommercePaymentSnapshot = {
  provider: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  status: CommercePaymentStatus;
  providerOccurredAt: Date | null;
};

export type VerifiedCommercePaymentEvent = {
  provider: string;
  eventId: string;
  paymentId: string;
  publicCheckoutId: string;
  kind: CommercePaymentEventKind;
  amountMinor: number;
  currency: string;
  occurredAt: Date;
  rawBodySha256: string;
};

export type CommercePaymentTransition = {
  applied: boolean;
  stale: boolean;
  paymentStatus: CommercePaymentStatus;
  orderStatus: CommerceOrderStatus;
  providerOccurredAt: Date | null;
  orderBecamePaid: boolean;
  shouldPauseProvisionedCase: boolean;
};


export type CommerceVerifiedEventProcessingResult = {
  replay: boolean;
  processingStatus: CommercePaymentEventProcessingStatus;
  rejectionCode: string | null;
  paymentStatus: CommercePaymentStatus | null;
  orderStatus: CommerceOrderStatus;
  orderBecamePaid: boolean;
  shouldPauseProvisionedCase: boolean;
};


export type CommerceCreatedOrder = {
  publicCheckoutId: string;
  planCode: CommerceOnlinePlanCode;
  amountMinor: number;
  currency: string;
  offerVersion: string;
  status: "PENDING_PAYMENT";
};
