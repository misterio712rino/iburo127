import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function isAuthorizedMaintenanceRequest(request: Request, secret: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) return false;
  const provided = authorization.slice(prefix.length);
  if (!provided) return false;
  return timingSafeEqual(digest(provided), digest(secret));
}
