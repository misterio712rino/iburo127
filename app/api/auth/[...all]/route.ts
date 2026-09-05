import { toNextJsHandler } from "better-auth/next-js";
import { getBetterAuthInstance } from "@/server/auth/better-auth-instance";
import { privateJsonResponse } from "@/server/http/private-json";

const ACCESS_GATE_ONLY_PATHS = new Set(["/api/auth/sign-in/email"]);

function handlers() {
  return toNextJsHandler(getBetterAuthInstance());
}

function isAccessGateOnlyPath(request: Request): boolean {
  try {
    return ACCESS_GATE_ONLY_PATHS.has(new URL(request.url).pathname);
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
