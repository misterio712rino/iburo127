// Bound remote control-plane responses before parsing them or allocating their JSON payloads.
export const STAGING_SCANNER_RESPONSE_DENIED = "STAGING_SCANNER_RESPONSE_DENIED";
const deny = (): never => { throw new Error(STAGING_SCANNER_RESPONSE_DENIED); };

export async function readBoundedScannerJson(response: Response, maxBytes: number): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) deny();
  const declared = response.headers.get("content-length");
  if (declared !== null &&
      (!/^(0|[1-9]\d*)$/.test(declared) || Number(declared) > maxBytes)) deny();
  const stream = response.body;
  if (stream === null) deny();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) deny();
      chunks.push(value);
    }
  } finally {
    if (total > maxBytes) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(
    Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
  )) as unknown;
}
