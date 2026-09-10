import { NextResponse, type NextRequest } from "next/server";
import { isVercelPreviewBackendAllowed } from "@/server/config/vercel-preview-boundary";
import { evaluatePlatformMutationOrigin } from "@/server/http/trusted-mutation-origin";
import {
  IB_STAGING_CONTROL_HEADER,
  isAuthorizedVercelAutomationRequest,
} from "@/server/staging/vercel-automation-auth";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

const STAGING_BACKEND_DISABLED = "STAGING_BACKEND_DISABLED";
const STAGING_CONTROL_UNAVAILABLE = "STAGING_CONTROL_UNAVAILABLE";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isStagingControlMutation(request: NextRequest): boolean {
  return (
    request.nextUrl.pathname.startsWith("/_iburo/") &&
    !SAFE_METHODS.has(request.method.toUpperCase())
  );
}

function logStagingControlDiagnostic(request: NextRequest) {
  if (
    process.env.VERCEL_ENV?.trim() !== "preview" ||
    process.env.IB_RUNTIME_TARGET?.trim() !== "staging"
  ) {
    return;
  }

  console.warn("STAGING_CONTROL_AUTH_REJECTED", {
    controlHeaderPresent: Boolean(request.headers.get(IB_STAGING_CONTROL_HEADER)),
    runtimeAutomationSecretConfigured: Boolean(
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim(),
    ),
  });
}

export function proxy(request: NextRequest) {
  if (!isVercelPreviewBackendAllowed()) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: STAGING_BACKEND_DISABLED },
      },
      {
        status: 503,
        headers: PRIVATE_NO_STORE_HEADERS,
      },
    );
  }

  if (isStagingControlMutation(request) && !isAuthorizedVercelAutomationRequest(request)) {
    logStagingControlDiagnostic(request);
    return NextResponse.json(
      {
        ok: false,
        error: { code: STAGING_CONTROL_UNAVAILABLE },
      },
      {
        status: 404,
        headers: PRIVATE_NO_STORE_HEADERS,
      },
    );
  }

  if (!request.nextUrl.pathname.startsWith("/api/platform/")) return NextResponse.next();

  const decision = evaluatePlatformMutationOrigin(request);
  if (decision.allowed) return NextResponse.next();

  return NextResponse.json(
    {
      ok: false,
      error: { code: decision.code },
    },
    {
      status: decision.status,
      headers: PRIVATE_NO_STORE_HEADERS,
    },
  );
}

export const config = {
  matcher: ["/app/:path*", "/portal/:path*", "/auth/:path*", "/api/:path*", "/_iburo/:path*"],
};
