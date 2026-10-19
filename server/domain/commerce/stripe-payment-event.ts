import { createHash } from "node:crypto";
import type Stripe from "stripe";

import type {
  CommercePaymentEventKind,
  VerifiedCommercePaymentEvent,
} from "@/server/domain/commerce/contracts";

export const STRIPE_SIGNATURE_INVALID = "STRIPE_SIGNATURE_INVALID";
export const STRIPE_EVENT_INVALID = "STRIPE_EVENT_INVALID";

type PaymentIntentResolver = (id: string) => Promise<Stripe.PaymentIntent>;

function requiredMetadata(metadata: Stripe.Metadata | null, key: string) {
  const value = metadata?.[key]?.trim();
  if (!value) throw new Error(STRIPE_EVENT_INVALID);
  return value;
}

function eventKind(value: string): CommercePaymentEventKind {
  return value as CommercePaymentEventKind;
}

function makeEvent(input: {
  event: Stripe.Event;
  rawBodySha256: string;
  paymentId: string;
  stripeCheckoutSessionId?: string;
  metadata: Stripe.Metadata | null;
  kind: CommercePaymentEventKind;
  amountMinor: number | null;
  currency: string | null;
}): VerifiedCommercePaymentEvent {
  const clientCaseId = requiredMetadata(input.metadata, "clientCaseId");
  const publicCheckoutId = requiredMetadata(input.metadata, "publicCheckoutId");
  if (!Number.isSafeInteger(input.amountMinor) || !input.amountMinor || !input.currency) {
    throw new Error(STRIPE_EVENT_INVALID);
  }
  return {
    provider: "stripe",
    eventId: input.event.id,
    paymentId: input.paymentId,
    publicCheckoutId,
    ...(input.stripeCheckoutSessionId !== undefined
      ? { stripeCheckoutSessionId: input.stripeCheckoutSessionId }
      : {}),
    kind: input.kind,
    amountMinor: input.amountMinor,
    currency: input.currency.toUpperCase(),
    occurredAt: new Date(input.event.created * 1000),
    rawBodySha256: input.rawBodySha256,
    clientCaseId,
  };
}

export async function eventFromStripe(
  event: Stripe.Event,
  rawBody: Buffer,
  resolvePaymentIntent: PaymentIntentResolver,
): Promise<VerifiedCommercePaymentEvent | null> {
  const rawBodySha256 = createHash("sha256").update(rawBody).digest("hex");

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.async_payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const failed = event.type === "checkout.session.async_payment_failed";
    const expired = event.type === "checkout.session.expired";
    if (!failed && !expired && session.payment_status !== "paid") return null;
    if (expired && (session.amount_total === null || !session.currency)) return null;

    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
    const kind = expired ? "CANCELLED" : failed ? "FAILED" : "SUCCEEDED";
    if (kind === "SUCCEEDED" && !paymentIntentId) throw new Error(STRIPE_EVENT_INVALID);
    const paymentId = paymentIntentId ?? session.id;
    return makeEvent({
      event,
      rawBodySha256,
      paymentId,
      stripeCheckoutSessionId: session.id,
      metadata: session.metadata,
      kind: eventKind(kind),
      amountMinor: session.amount_total,
      currency: session.currency,
    });
  }

  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed" ||
    event.type === "payment_intent.canceled"
  ) {
    const intent = event.data.object as Stripe.PaymentIntent;
    const kind = event.type === "payment_intent.succeeded"
      ? "SUCCEEDED"
      : event.type === "payment_intent.payment_failed" ? "FAILED" : "CANCELLED";
    const amount = kind === "SUCCEEDED" ? intent.amount_received : intent.amount;
    return makeEvent({
      event,
      rawBodySha256,
      paymentId: intent.id,
      metadata: intent.metadata,
      kind: eventKind(kind),
      amountMinor: amount,
      currency: intent.currency,
    });
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    if (charge.amount_refunded < charge.amount) return null;
    const paymentIntentId = typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
    if (!paymentIntentId) throw new Error(STRIPE_EVENT_INVALID);
    const intent = await resolvePaymentIntent(paymentIntentId);
    return makeEvent({
      event,
      rawBodySha256,
      paymentId: intent.id,
      metadata: intent.metadata,
      kind: "REFUNDED",
      amountMinor: charge.amount,
      currency: charge.currency,
    });
  }

  if (event.type === "charge.dispute.closed") {
    const dispute = event.data.object as Stripe.Dispute;
    if (dispute.status !== "lost" && dispute.status !== "won") return null;

    const paymentIntentId = typeof dispute.payment_intent === "string"
      ? dispute.payment_intent
      : dispute.payment_intent?.id;
    if (!paymentIntentId) throw new Error(STRIPE_EVENT_INVALID);

    const intent = await resolvePaymentIntent(paymentIntentId);
    return makeEvent({
      event,
      rawBodySha256,
      paymentId: intent.id,
      metadata: intent.metadata,
      kind: dispute.status === "lost" ? "CHARGEBACK" : "SUCCEEDED",
      amountMinor: intent.amount_received,
      currency: intent.currency,
    });
  }

  return null;
}
