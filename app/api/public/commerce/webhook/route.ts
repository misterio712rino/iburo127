import { StripeWebhookService } from "@/server/domain/commerce/payment-webhook-service";
import {
  STRIPE_EVENT_INVALID,
  STRIPE_SIGNATURE_INVALID,
} from "@/server/domain/commerce/stripe-payment-event";
import { PrismaCommercePaymentEventRepository } from "@/server/repositories/prisma/commerce-payment-event-repository";
import { getStripeClient, readStripeWebhookSecret } from "@/server/commerce/stripe-client";
import { StripeWebhookGatewayImpl } from "@/server/commerce/stripe-webhook-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 1024 * 1024;

async function readRawBody(request: Request): Promise<Buffer | null> {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await readRawBody(request);
  if (rawBody === null) {
    return json({ ok: false, error: { code: "WEBHOOK_BODY_TOO_LARGE" } }, 413);
  }
  if (!signature || rawBody.length === 0) {
    return json({ ok: false, error: { code: STRIPE_SIGNATURE_INVALID } }, 400);
  }

  try {
    const stripe = getStripeClient();
    const service = new StripeWebhookService(
      new PrismaCommercePaymentEventRepository(),
      new StripeWebhookGatewayImpl(stripe),
      readStripeWebhookSecret(),
    );
    const result = await service.handle(rawBody, signature);
    return json({ ok: true, ...result }, 200);
  } catch (error) {
    if (error instanceof Error && (
      error.message === STRIPE_SIGNATURE_INVALID ||
      error.message === STRIPE_EVENT_INVALID
    )) {
      return json({ ok: false, error: { code: error.message } }, 400);
    }
    return json({ ok: false, error: { code: "COMMERCE_WEBHOOK_RETRY" } }, 500);
  }
}
