import "server-only";

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

function parseDeclaredContentLength(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function readBoundedJsonBody(
  request: Request,
  maxBytes = PLATFORM_JSON_BODY_MAX_BYTES,
): Promise<BoundedJsonBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("bounded JSON body maxBytes must be a positive safe integer");
  }

  const declaredLength = parseDeclaredContentLength(
    request.headers.get("content-length"),
  );
  if (declaredLength !== null && declaredLength > maxBytes) {
    return { ok: false, response: payloadTooLargeResponse() };
  }

  if (!request.body) {
    return { ok: true, value: undefined };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The request is already rejected; cancellation failure must not expose internals.
        }
        return { ok: false, response: payloadTooLargeResponse() };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: true, value: undefined };
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    return { ok: true, value: undefined };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: true, value: undefined };
  }
}
