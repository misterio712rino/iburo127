import { NextResponse, type NextRequest } from "next/server";
import { evaluatePlatformMutationOrigin } from "@/server/http/trusted-mutation-origin";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

export function proxy(request: NextRequest) {
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
  matcher: ["/api/platform/:path*"],
};
