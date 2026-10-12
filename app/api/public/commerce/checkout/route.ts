import {
  COMMERCE_CASE_CHECKOUT_PENDING,
  COMMERCE_CASE_NOT_FOUND,
  COMMERCE_CASE_PLAN_UNCHANGED,
  COMMERCE_CHECKOUT_NO_LONGER_PENDING,
  COMMERCE_CHECKOUT_SESSION_RECOVERY_REQUIRED,
  COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT,
  COMMERCE_INVALID_INPUT,
  COMMERCE_PLAN_UNAVAILABLE,
  COMMERCE_UNSUPPORTED_PLAN,
} from "@/server/domain/commerce/contracts";
import { requireRole } from "@/server/auth/contracts";
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
import { getStripeClient } from "@/server/commerce/stripe-client";
import { StripeCheckoutGateway } from "@/server/commerce/stripe-checkout-gateway";
import { CommerceCheckoutService } from "@/server/domain/commerce/checkout-service";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { requireServerActor, UNAUTHENTICATED } from "@/server/auth/runtime";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse } from "@/server/http/private-json";
import { PrismaCommerceCaseCheckoutRepository } from "@/server/repositories/prisma/commerce-case-checkout-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECKOUT_BODY_MAX_BYTES = 4 * 1024;

function unavailable() {
  return privateJsonResponse(
    { ok: false, error: { code: "COMMERCE_CHECKOUT_UNAVAILABLE" } },
    503,
  );
}

function commerceResponse(allowedOrigin: string, body: unknown, status = 200, additionalHeaders?: HeadersInit) {
  const headers = commerceCheckoutCorsHeaders(allowedOrigin);
  if (additionalHeaders) {
    new Headers(additionalHeaders).forEach((value, key) => headers.set(key, value));
  }
  return privateJsonResponse(body, status, headers);
}

function withCors(response: Response, allowedOrigin: string) {
  const headers = new Headers(response.headers);
  commerceCheckoutCorsHeaders(allowedOrigin).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
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
  return new Response(null, { status: 204, headers: commerceCheckoutCorsHeaders(config.allowedOrigin) });
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
    return commerceResponse(config.allowedOrigin, { ok: false, error: { code: "COMMERCE_CHECKOUT_UNAVAILABLE" } }, 503);
  }

  const body = await readBoundedJsonBody(request, CHECKOUT_BODY_MAX_BYTES);
  if (!body.ok) return withCors(body.response, config.allowedOrigin);

  let input;
  try {
    input = parseCommerceCheckoutBody(body.value);
  } catch (error) {
    if (error instanceof Error && error.message === COMMERCE_INVALID_INPUT) {
      return commerceResponse(config.allowedOrigin, { ok: false, error: { code: "INVALID_CHECKOUT_REQUEST" } }, 400);
    }
    return unavailable();
  }

  try {
    const actor = await requireServerActor(createProductionSessionProvider());
    requireRole(actor, "CLIENT");

    const service = new CommerceCheckoutService(
      new PrismaCommerceCaseCheckoutRepository(),
      new StripeCheckoutGateway(getStripeClient()),
    );
    const result = await service.startCheckout({
      userId: actor.userId,
      clientCaseId: input.clientCaseId,
      requestId: input.requestId,
      planCode: input.planCode,
      catalog: config.catalog,
      origin: config.allowedOrigin,
    });
    return commerceResponse(
      config.allowedOrigin,
      {
        ok: true,
        order: {
          publicCheckoutId: result.order.publicCheckoutId,
          planCode: result.order.planCode,
          amountMinor: result.order.amountMinor,
          currency: result.order.currency,
          offerVersion: result.order.offerVersion,
          status: result.order.status,
          replayed: result.replayed,
        },
        checkoutUrl: result.checkoutUrl,
      },
      result.replayed ? 200 : 201,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === UNAUTHENTICATED) {
      return commerceResponse(config.allowedOrigin, { ok: false, error: { code: "UNAUTHENTICATED" } }, 401);
    }
    if (code === "FORBIDDEN") {
      return commerceResponse(config.allowedOrigin, { ok: false, error: { code: "FORBIDDEN" } }, 403);
    }
    if (code === COMMERCE_CASE_NOT_FOUND) {
      return commerceResponse(config.allowedOrigin, { ok: false, error: { code: "CASE_NOT_FOUND" } }, 404);
    }
    if (
      code === COMMERCE_CHECKOUT_NO_LONGER_PENDING ||
      code === COMMERCE_CHECKOUT_SESSION_RECOVERY_REQUIRED
    ) {
      return commerceResponse(config.allowedOrigin, { ok: false, error: { code } }, 409);
    }
    if (code === COMMERCE_CASE_CHECKOUT_PENDING || code === COMMERCE_CASE_PLAN_UNCHANGED) {
      return commerceResponse(config.allowedOrigin, { ok: false, error: { code } }, 409);
    }
    if (code === COMMERCE_CHECKOUT_IDEMPOTENCY_CONFLICT) {
      return commerceResponse(config.allowedOrigin, { ok: false, error: { code: "CHECKOUT_IDEMPOTENCY_CONFLICT" } }, 409);
    }
    if (code === COMMERCE_INVALID_INPUT || code === COMMERCE_UNSUPPORTED_PLAN || code === COMMERCE_PLAN_UNAVAILABLE) {
      return commerceResponse(config.allowedOrigin, { ok: false, error: { code: "INVALID_CHECKOUT_REQUEST" } }, 400);
    }
    return commerceResponse(config.allowedOrigin, { ok: false, error: { code: "COMMERCE_CHECKOUT_UNAVAILABLE" } }, 503);
  }
}
