import { NextResponse, type NextRequest } from "next/server";
import { isVercelPreviewBackendAllowed } from "@/server/config/vercel-preview-boundary";
import { evaluatePlatformMutationOrigin } from "@/server/http/trusted-mutation-origin";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

const STAGING_BACKEND_DISABLED = "STAGING_BACKEND_DISABLED";

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
  matcher: ["/app/:path*", "/portal/:path*", "/auth/:path*", "/api/:path*"],
};
