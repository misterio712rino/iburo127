import {
  COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT,
  COMMERCE_INVALID_INPUT,
  COMMERCE_PLAN_UNAVAILABLE,
  COMMERCE_UNSUPPORTED_PLAN,
} from "@/server/domain/commerce/contracts";
import {
  commerceCheckoutCorsHeaders,
  isAllowedCommerceCheckoutOrigin,
  parseCommerceCheckoutBody,
} from "@/server/domain/commerce/checkout-http";
import { readCommerceCheckoutRuntimeConfig } from "@/server/config/commerce";
import {
  CommerceCheckoutRateLimitError,
  enforceCommerceCheckoutRateLimit,
} from "@/server/commerce/checkout-rate-limit";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse } from "@/server/http/private-json";
import { PrismaCommerceOrderRepository } from "@/server/repositories/prisma/commerce-order-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECKOUT_BODY_MAX_BYTES = 4 * 1024;

function unavailable() {
  return privateJsonResponse(
    { ok: false, error: { code: "COMMERCE_CHECKOUT_UNAVAILABLE" } },
    503,
  );
}

function commerceResponse(
  allowedOrigin: string,
  body: unknown,
  status = 200,
  additionalHeaders?: HeadersInit,
) {
  const headers = commerceCheckoutCorsHeaders(allowedOrigin);
  if (additionalHeaders) {
    const extra = new Headers(additionalHeaders);
    extra.forEach((value, key) => headers.set(key, value));
  }
  return privateJsonResponse(body, status, headers);
}

function withCors(response: Response, allowedOrigin: string) {
  const headers = new Headers(response.headers);
  commerceCheckoutCorsHeaders(allowedOrigin).forEach((value, key) =>
    headers.set(key, value),
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function OPTIONS(request: Request) {
  let config;
  try {
    config = readCommerceCheckoutRuntimeConfig();
  } catch {
    return unavailable();
  }

  if (!isAllowedCommerceCheckoutOrigin(request, config.allowedOrigin)) {
    return privateJsonResponse(
      { ok: false, error: { code: "COMMERCE_CHECKOUT_ORIGIN_REJECTED" } },
      403,
    );
  }

  return new Response(null, {
    status: 204,
    headers: commerceCheckoutCorsHeaders(config.allowedOrigin),
  });
}

export async function POST(request: Request) {
  let config;
  try {
    config = readCommerceCheckoutRuntimeConfig();
  } catch {
    return unavailable();
  }

  if (!isAllowedCommerceCheckoutOrigin(request, config.allowedOrigin)) {
    return privateJsonResponse(
      { ok: false, error: { code: "COMMERCE_CHECKOUT_ORIGIN_REJECTED" } },
      403,
    );
  }

  try {
    await enforceCommerceCheckoutRateLimit(request);
  } catch (error) {
    if (error instanceof CommerceCheckoutRateLimitError) {
      return commerceResponse(
        config.allowedOrigin,
        { ok: false, error: { code: "RATE_LIMITED" } },
        429,
        { "Retry-After": String(error.retryAfterSeconds) },
      );
    }
    return commerceResponse(
      config.allowedOrigin,
      { ok: false, error: { code: "COMMERCE_CHECKOUT_UNAVAILABLE" } },
      503,
    );
  }

  const body = await readBoundedJsonBody(request, CHECKOUT_BODY_MAX_BYTES);
  if (!body.ok) {
    return withCors(body.response, config.allowedOrigin);
  }

  let input;
  try {
    input = parseCommerceCheckoutBody(body.value);
  } catch (error) {
    if (error instanceof Error && error.message === COMMERCE_INVALID_INPUT) {
      return commerceResponse(
        config.allowedOrigin,
        { ok: false, error: { code: "INVALID_CHECKOUT_REQUEST" } },
        400,
      );
    }
    return commerceResponse(
      config.allowedOrigin,
      { ok: false, error: { code: "COMMERCE_CHECKOUT_UNAVAILABLE" } },
      503,
    );
  }

  try {
    const order = await new PrismaCommerceOrderRepository().createPendingOrder({
      planCode: input.planCode,
      customerEmail: input.email,
      checkoutRequestId: input.requestId,
      catalog: config.catalog,
    });

    return commerceResponse(
      config.allowedOrigin,
      {
        ok: true,
        order: {
          publicCheckoutId: order.publicCheckoutId,
          planCode: order.planCode,
          amountMinor: order.amountMinor,
          currency: order.currency,
          offerVersion: order.offerVersion,
          status: order.status,
          replayed: order.replayed,
        },
      },
      order.replayed ? 200 : 201,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT
    ) {
      return commerceResponse(
        config.allowedOrigin,
        { ok: false, error: { code: "CHECKOUT_IDEMPOTENCY_CONFLICT" } },
        409,
      );
    }

    if (
      error instanceof Error &&
      (error.message === COMMERCE_UNSUPPORTED_PLAN ||
        error.message === COMMERCE_PLAN_UNAVAILABLE ||
        error.message === COMMERCE_INVALID_INPUT)
    ) {
      return commerceResponse(
        config.allowedOrigin,
        { ok: false, error: { code: "INVALID_CHECKOUT_REQUEST" } },
        400,
      );
    }

    return commerceResponse(
      config.allowedOrigin,
      { ok: false, error: { code: "COMMERCE_CHECKOUT_UNAVAILABLE" } },
      503,
    );
  }
}
