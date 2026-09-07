import "server-only";

import { readJsonBodyWithByteLimit } from "@/server/http/bounded-json-core";
import { privateJsonResponse } from "@/server/http/private-json";

export const PLATFORM_JSON_BODY_MAX_BYTES = 64 * 1024;

export type BoundedJsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; response: Response };

function payloadTooLargeResponse(): Response {
  return privateJsonResponse(
    { ok: false, error: { code: "PAYLOAD_TOO_LARGE" } },
    413,
  );
}

export async function readBoundedJsonBody(
  request: Request,
  maxBytes = PLATFORM_JSON_BODY_MAX_BYTES,
): Promise<BoundedJsonBodyResult> {
  const result = await readJsonBodyWithByteLimit(request, maxBytes);
  if (result.status === "too_large") {
    return { ok: false, response: payloadTooLargeResponse() };
  }
  return { ok: true, value: result.value };
}
