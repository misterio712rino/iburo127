import { toNextJsHandler } from "better-auth/next-js";
import { getBetterAuthInstance } from "@/server/auth/better-auth-instance";

function handlers() {
  return toNextJsHandler(getBetterAuthInstance());
}

export async function GET(request: Request) {
  return handlers().GET(request);
}

export async function POST(request: Request) {
  return handlers().POST(request);
}
