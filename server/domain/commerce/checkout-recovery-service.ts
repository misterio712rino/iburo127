import "server-only";

import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";
import { STRIPE_CHECKOUT_IDEMPOTENCY_SAFE_WINDOW_MS } from "@/server/domain/commerce/checkout-service";

export const COMMERCE_CHECKOUT_RECOVERY_INVALID_INPUT = "COMMERCE_CHECKOUT_RECOVERY_INVALID_INPUT";
export const COMMERCE_CHECKOUT_RECOVERY_FORBIDDEN = "COMMERCE_CHECKOUT_RECOVERY_FORBIDDEN";
export const COMMERCE_CHECKOUT_RECOVERY_ORDER_NOT_FOUND = "COMMERCE_CHECKOUT_RECOVERY_ORDER_NOT_FOUND";
export const COMMERCE_CHECKOUT_RECOVERY_NOT_ELIGIBLE = "COMMERCE_CHECKOUT_RECOVERY_NOT_ELIGIBLE";
export const COMMERCE_CHECKOUT_RECOVERY_SESSION_MISMATCH = "COMMERCE_CHECKOUT_RECOVERY_SESSION_MISMATCH";
export const COMMERCE_CHECKOUT_RECOVERY_CONFLICT = "COMMERCE_CHECKOUT_RECOVERY_CONFLICT";

export type CheckoutRecoveryCandidate = {
  id: string;
  publicCheckoutId: string;
  clientCaseId: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  stripeCheckoutSessionId: string | null;
  createStartedAt: Date | null;
  paymentCount: number;
  eventCount: number;
  recoveredSessionId: string | null;
};

export type RecoveredStripeCheckoutSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  mode: string;
  clientReferenceId: string | null;
  metadata: { publicCheckoutId?: string; clientCaseId?: string } | null;
  amountTotal: number | null;
  currency: string | null;
};

export interface CommerceCheckoutRecoveryRepository {
  getCandidate(publicCheckoutId: string): Promise<CheckoutRecoveryCandidate | null>;
  attachExistingSession(input: {
    orderId: string;
    publicCheckoutId: string;
    stripeCheckoutSessionId: string;
    expectedCreateStartedAt: Date;
    cutoff: Date;
    operatorUserId: string;
    evidenceReference: string;
  }): Promise<void>;
}

export interface CommerceCheckoutRecoveryStripeGateway {
  retrieveSession(id: string): Promise<RecoveredStripeCheckoutSession>;
}

function invalidInput(): never {
  throw new Error(COMMERCE_CHECKOUT_RECOVERY_INVALID_INPUT);
}

export function parseCheckoutRecoveryInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidInput();
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "evidenceReference" ||
    keys[1] !== "publicCheckoutId" ||
    keys[2] !== "stripeCheckoutSessionId"
  ) invalidInput();

  const publicCheckoutId = record.publicCheckoutId;
  const stripeCheckoutSessionId = record.stripeCheckoutSessionId;
  const evidenceReference = record.evidenceReference;
  if (
    typeof publicCheckoutId !== "string" ||
    publicCheckoutId.length < 8 ||
    publicCheckoutId.length > 128 ||
    !/^chk_[A-Za-z0-9_-]+$/.test(publicCheckoutId) ||
    typeof stripeCheckoutSessionId !== "string" ||
    !/^cs_(test|live)_[A-Za-z0-9]+$/.test(stripeCheckoutSessionId) ||
    typeof evidenceReference !== "string" ||
    !/^[A-Z0-9][A-Z0-9._:-]{2,63}$/.test(evidenceReference)
  ) invalidInput();

  return { publicCheckoutId, stripeCheckoutSessionId, evidenceReference };
}

export class CommerceCheckoutRecoveryService {
  constructor(
    private readonly repository: CommerceCheckoutRecoveryRepository,
    private readonly stripe: CommerceCheckoutRecoveryStripeGateway,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async attachExistingOpenSession(actor: AuthenticatedActor, value: unknown) {
    if (!actor.roles.includes("MANAGER")) {
      throw new Error(COMMERCE_CHECKOUT_RECOVERY_FORBIDDEN);
    }
    const input = parseCheckoutRecoveryInput(value);
    const candidate = await this.repository.getCandidate(input.publicCheckoutId);
    if (!candidate) throw new Error(COMMERCE_CHECKOUT_RECOVERY_ORDER_NOT_FOUND);

    if (candidate.recoveredSessionId) {
      if (
        candidate.recoveredSessionId !== input.stripeCheckoutSessionId ||
        candidate.stripeCheckoutSessionId !== candidate.recoveredSessionId
      ) {
        throw new Error(COMMERCE_CHECKOUT_RECOVERY_CONFLICT);
      }
      return { stripeCheckoutSessionId: candidate.recoveredSessionId, replayed: true };
    }

    const now = this.now();
    const cutoff = new Date(now.getTime() - STRIPE_CHECKOUT_IDEMPOTENCY_SAFE_WINDOW_MS);
    if (
      candidate.status !== "PENDING_PAYMENT" ||
      candidate.stripeCheckoutSessionId !== null ||
      candidate.createStartedAt === null ||
      candidate.createStartedAt.getTime() > cutoff.getTime() ||
      !candidate.clientCaseId ||
      candidate.paymentCount !== 0 ||
      candidate.eventCount !== 0
    ) {
      throw new Error(COMMERCE_CHECKOUT_RECOVERY_NOT_ELIGIBLE);
    }

    const session = await this.stripe.retrieveSession(input.stripeCheckoutSessionId);
    let checkoutUrlIsValid = false;
    if (session.url) {
      try {
        const checkoutUrl = new URL(session.url);
        checkoutUrlIsValid = checkoutUrl.protocol === "https:" && checkoutUrl.hostname === "checkout.stripe.com";
      } catch {
        checkoutUrlIsValid = false;
      }
    }
    if (
      session.id !== input.stripeCheckoutSessionId ||
      session.status !== "open" ||
      !checkoutUrlIsValid ||
      session.mode !== "payment" ||
      session.clientReferenceId !== candidate.publicCheckoutId ||
      session.metadata?.publicCheckoutId !== candidate.publicCheckoutId ||
      session.metadata?.clientCaseId !== candidate.clientCaseId ||
      session.amountTotal !== candidate.amountMinor ||
      session.currency?.toLowerCase() !== candidate.currency.toLowerCase()
    ) {
      throw new Error(COMMERCE_CHECKOUT_RECOVERY_SESSION_MISMATCH);
    }

    await this.repository.attachExistingSession({
      orderId: candidate.id,
      publicCheckoutId: candidate.publicCheckoutId,
      stripeCheckoutSessionId: session.id,
      expectedCreateStartedAt: candidate.createStartedAt,
      cutoff,
      operatorUserId: actor.userId,
      evidenceReference: input.evidenceReference,
    });
    return { stripeCheckoutSessionId: session.id, replayed: false };
  }
}
