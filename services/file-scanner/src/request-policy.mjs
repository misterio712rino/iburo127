import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES, MAX_REQUEST_BODY_BYTES } from "./constants.mjs";
import { SafeScannerError } from "./errors.mjs";

function badRequest() {
  return new SafeScannerError("INVALID_REQUEST", 400);
}

export function parseScanRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest();
  const entries = Object.entries(value);
  const keys = entries.map(([key]) => key).sort();
  if (keys.join(",") !== "mimeType,sizeBytes,sourceUrl") throw badRequest();
  const { sourceUrl, mimeType, sizeBytes } = value;
  if (typeof sourceUrl !== "string" || typeof mimeType !== "string" || typeof sizeBytes !== "string") {
    throw badRequest();
  }
  if (!sourceUrl || sourceUrl.length > 6_144 || /[\r\n\0]/.test(sourceUrl)) throw badRequest();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw badRequest();
  if (!/^[1-9]\d*$/.test(sizeBytes)) throw badRequest();
  const parsedSize = Number(sizeBytes);
  if (!Number.isSafeInteger(parsedSize) || parsedSize > MAX_FILE_BYTES) throw badRequest();
  return Object.freeze({ sourceUrl, mimeType, sizeBytes: parsedSize });
}

export async function readBoundedJson(request, maximumBytes = MAX_REQUEST_BODY_BYTES, timeoutMs = 5_000) {
  const declared = request.headers["content-length"];
  if (declared !== undefined) {
    const normalized = Array.isArray(declared) ? declared[0] : declared;
    if (!/^\d+$/.test(normalized) || Number(normalized) > maximumBytes) throw badRequest();
  }

  const chunks = [];
  let total = 0;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    request.destroy();
  }, timeoutMs);
  try {
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += bytes.length;
      if (total > maximumBytes) {
        request.destroy();
        throw badRequest();
      }
      chunks.push(bytes);
    }
  } catch {
    throw badRequest();
  } finally {
    clearTimeout(timeout);
  }
  if (timedOut) throw badRequest();
  if (total === 0) throw badRequest();
  let parsed;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, total));
    parsed = JSON.parse(text);
  } catch {
    throw badRequest();
  }
  return parseScanRequest(parsed);
}
