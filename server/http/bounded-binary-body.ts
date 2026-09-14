import "server-only";

export const EMPTY_BINARY_BODY = "EMPTY_BINARY_BODY";
export const BINARY_BODY_TOO_LARGE = "BINARY_BODY_TOO_LARGE";

export async function readBinaryBodyWithByteLimit(request: Request, maxBytes: number) {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("INVALID_BINARY_BODY_LIMIT");
  }
  if (!request.body) throw new Error(EMPTY_BINARY_BODY);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(BINARY_BODY_TOO_LARGE);
    }
    chunks.push(value);
  }

  if (total <= 0) throw new Error(EMPTY_BINARY_BODY);

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
