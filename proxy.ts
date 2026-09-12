import { NextResponse, type NextRequest } from "next/server";
import { isVercelPreviewBackendAllowed } from "@/server/config/vercel-preview-boundary";
import { getManualTrailingSlashRedirectPath } from "@/server/http/trailing-slash-policy";
import { evaluatePlatformMutationOrigin } from "@/server/http/trusted-mutation-origin";
import { isAuthorizedVercelAutomationRequest } from "@/server/staging/vercel-automation-auth";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

const STAGING_BACKEND_DISABLED = "STAGING_BACKEND_DISABLED";
const STAGING_CONTROL_UNAVAILABLE = "STAGING_CONTROL_UNAVAILABLE";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SECURITY_PATH_PREFIXES = ["/app", "/portal", "/auth", "/api", "/_iburo"] as const;

function isSecurityPath(pathname: string): boolean {
  return SECURITY_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isStagingControlMutation(request: NextRequest): boolean {
  return (
    request.nextUrl.pathname.startsWith("/_iburo/") &&
    !SAFE_METHODS.has(request.method.toUpperCase())
  );
}

function trailingSlashRedirect(request: NextRequest, pathname: string) {
  const canonicalUrl = new URL(request.url);
  canonicalUrl.pathname = pathname;
  const response = NextResponse.redirect(canonicalUrl, 308);
  if (isSecurityPath(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", PRIVATE_NO_STORE_HEADERS["Cache-Control"]);
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const canonicalPathname = getManualTrailingSlashRedirectPath(request.nextUrl.pathname);
  const securityPath = isSecurityPath(request.nextUrl.pathname);

  if (!securityPath) {
    return canonicalPathname
      ? trailingSlashRedirect(request, canonicalPathname)
      : NextResponse.next();
  }

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

  if (
    isStagingControlMutation(request) &&
    !(await isAuthorizedVercelAutomationRequest(request))
  ) {
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

  if (request.nextUrl.pathname.startsWith("/api/platform/")) {
    const decision = evaluatePlatformMutationOrigin(request);
    if (!decision.allowed) {
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
  }

  return canonicalPathname
    ? trailingSlashRedirect(request, canonicalPathname)
    : NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
