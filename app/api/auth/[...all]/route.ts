import { toNextJsHandler } from "better-auth/next-js";
import { getBetterAuthInstance } from "@/server/auth/better-auth-instance";
import { privateJsonResponse } from "@/server/http/private-json";

const ACCESS_GATE_ONLY_PATHS = new Set(["/api/auth/sign-in/email"]);

function handlers() {
  return toNextJsHandler(getBetterAuthInstance());
}

function canonicalizeAuthPath(pathname: string): string {
  if (pathname.length <= 1) return pathname;
  return pathname.replace(/\/+$/, "");
}

function isAccessGateOnlyPath(request: Request): boolean {
  try {
    const pathname = canonicalizeAuthPath(new URL(request.url).pathname);
    return ACCESS_GATE_ONLY_PATHS.has(pathname);
  } catch {
    return true;
  }
}

export async function GET(request: Request) {
  return handlers().GET(request);
}

export async function POST(request: Request) {
  if (isAccessGateOnlyPath(request)) {
    return privateJsonResponse(
      { ok: false, error: { code: "ACCESS_GATE_REQUIRED" } },
      404,
    );
  }
  return handlers().POST(request);
}
