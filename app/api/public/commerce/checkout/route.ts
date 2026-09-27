import {
  COMMERCE_INVALID_INPUT,
  COMMERCE_PLAN_UNAVAILABLE,
  COMMERCE_UNSUPPORTED_PLAN,
} from "@/server/domain/commerce/contracts";
import { readBoundedJsonBody } from "@/server/http/bounded-json-body";
import { privateJsonResponse, privateResponse } from "@/server/http/private-json";
import {
  CommerceCheckoutRateLimitError,
  enforceCommerceCheckoutRateLimit,
} from "@/server/commerce/checkout-rate-limit";
import { parseCommerceCheckoutRequest } from "@/server/commerce/checkout-request";
import {
  COMMERCE_CHECKOUT_CONFIG_ERROR,
  readCommerceCheckoutRuntimeConfig,
} from "@/server/commerce/runtime";
import { PrismaCommerceOrderRepository } from "@/server/repositories/prisma/commerce-order-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECKOUT_BODY_MAX_BYTES = 4 * 1024;

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function configuredRequestOrigin(request: Request, marketingOrigin: string) {
  const origin = request.headers.get("origin")?.trim() ?? "";
  return origin === marketingOrigin ? origin : null;
}

function validJsonContentType(request: Request) {
  const value = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  return value === "application/json";
}

function configUnavailable(error: unknown) {
  return (
    error instanceof Error &&
    error.message.startsWith(`${COMMERCE_CHECKOUT_CONFIG_ERROR}:`)
  );
}

export async function OPTIONS(request: Request): Promise<Response> {
  let config;
  try {
    config = readCommerceCheckoutRuntimeConfig();
  } catch {
    return privateResponse(null, { status: 503 });
  }

  const origin = configuredRequestOrigin(request, config.marketingOrigin);
  if (!origin) {
    return privateResponse(null, { status: 403 });
  }

  const requestedMethod =
    request.headers.get("access-control-request-method")?.trim().toUpperCase() ?? "";
  const requestedHeaders =
    request.headers.get("access-control-request-headers")?.trim().toLowerCase() ?? "";
  if (
    requestedMethod !== "POST" ||
    (requestedHeaders !== "" && requestedHeaders !== "content-type")
  ) {
    return privateResponse(null, { status: 403, headers: corsHeaders(origin) });
  }

  return privateResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function POST(request: Request): Promise<Response> {
  let config;
  try {
    config = readCommerceCheckoutRuntimeConfig();
  } catch (error) {
    if (configUnavailable(error)) {
      return privateJsonResponse(
        { ok: false, error: { code: "CHECKOUT_NOT_CONFIGURED" } },
        503,
      );
    }
    return privateJsonResponse(
      { ok: false, error: { code: "CHECKOUT_UNAVAILABLE" } },
      503,
    );
  }

  const origin = configuredRequestOrigin(request, config.marketingOrigin);
  if (!origin) {
    return privateJsonResponse(
      { ok: false, error: { code: "FORBIDDEN_ORIGIN" } },
      403,
    );
  }
  const responseHeaders = corsHeaders(origin);

  if (!validJsonContentType(request)) {
    return privateJsonResponse(
      { ok: false, error: { code: "INVALID_CHECKOUT_REQUEST" } },
      415,
      responseHeaders,
    );
  }

  try {
    await enforceCommerceCheckoutRateLimit(request);
  } catch (error) {
    if (error instanceof CommerceCheckoutRateLimitError) {
      return privateJsonResponse(
        { ok: false, error: { code: "RATE_LIMITED" } },
        429,
        {
          ...responseHeaders,
          "Retry-After": String(error.retryAfterSeconds),
        },
      );
    }
    return privateJsonResponse(
      { ok: false, error: { code: "CHECKOUT_UNAVAILABLE" } },
      503,
      responseHeaders,
    );
  }

  const body = await readBoundedJsonBody(request, CHECKOUT_BODY_MAX_BYTES);
  if (!body.ok) {
    for (const [key, value] of new Headers(responseHeaders)) {
      body.response.headers.set(key, value);
    }
    return body.response;
  }

  let input;
  try {
    input = parseCommerceCheckoutRequest(body.value);
  } catch {
    return privateJsonResponse(
      { ok: false, error: { code: "INVALID_CHECKOUT_REQUEST" } },
      400,
      responseHeaders,
    );
  }

  try {
    const order = await new PrismaCommerceOrderRepository().createPendingOrder({
      planCode: input.planCode,
      customerEmail: input.customerEmail,
      catalog: config.catalog,
    });

    return privateJsonResponse(
      {
        ok: true,
        data: {
          publicCheckoutId: order.publicCheckoutId,
          planCode: order.planCode,
          amountMinor: order.amountMinor,
          currency: order.currency,
          offerVersion: order.offerVersion,
          status: order.status,
          paymentProviderReady: false,
        },
      },
      201,
      responseHeaders,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === COMMERCE_INVALID_INPUT ||
        error.message === COMMERCE_UNSUPPORTED_PLAN)
    ) {
      return privateJsonResponse(
        { ok: false, error: { code: "INVALID_CHECKOUT_REQUEST" } },
        400,
        responseHeaders,
      );
    }
    if (error instanceof Error && error.message === COMMERCE_PLAN_UNAVAILABLE) {
      return privateJsonResponse(
        { ok: false, error: { code: "CHECKOUT_UNAVAILABLE" } },
        409,
        responseHeaders,
      );
    }
    return privateJsonResponse(
      { ok: false, error: { code: "CHECKOUT_UNAVAILABLE" } },
      503,
      responseHeaders,
    );
  }
}
