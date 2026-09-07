export type BoundedJsonCoreResult =
  | { status: "ok"; value: unknown }
  | { status: "too_large" };

function parseDeclaredContentLength(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function readJsonBodyWithByteLimit(
  request: Request,
  maxBytes: number,
): Promise<BoundedJsonCoreResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("bounded JSON body maxBytes must be a positive safe integer");
  }

  const declaredLength = parseDeclaredContentLength(
    request.headers.get("content-length"),
  );
  if (declaredLength !== null && declaredLength > maxBytes) {
    return { status: "too_large" };
  }

  if (!request.body) {
    return { status: "ok", value: undefined };
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
          // Rejection is already decided; cancellation failure is intentionally ignored.
        }
        return { status: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { status: "ok", value: undefined };
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    return { status: "ok", value: undefined };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { status: "ok", value: JSON.parse(text) as unknown };
  } catch {
    return { status: "ok", value: undefined };
  }
}
