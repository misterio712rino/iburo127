// Run before issuing any Blob fixture capability or uploading synthetic data.
export const STAGING_SCANNER_HEALTH_DENIED = "STAGING_SCANNER_HEALTH_DENIED";
const ORIGIN = "https://scanner-v2-staging.iburo127.online";
const MAX_HEALTH_BYTES = 128;
const fail = (): never => { throw new Error(STAGING_SCANNER_HEALTH_DENIED); };

export async function verifyAuthorizedStagingScannerHealth(
  origin: string,
  secret: string,
  request: typeof fetch = fetch,
): Promise<void> {
  if (origin !== ORIGIN || typeof secret !== "string" || secret.length < 32 ||
      /[\r\n\0]/.test(secret)) fail();
  try {
    const response = await request(`${ORIGIN}/health`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    if (response.status !== 200 ||
        response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") fail();
    const advertised = response.headers.get("content-length");
    if (advertised !== null && (!/^\d{1,3}$/.test(advertised) || Number(advertised) > MAX_HEALTH_BYTES)) fail();
    const healthStream = response.body;
    if (!healthStream) fail();
    const reader = healthStream.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        bytes += value.byteLength;
        if (bytes > MAX_HEALTH_BYTES) fail();
        chunks.push(value);
      }
    } finally {
      if (bytes > MAX_HEALTH_BYTES) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const body = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
    );
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
        Object.keys(parsed).length !== 1 || (parsed as { status?: unknown }).status !== "ok") fail();
  } catch { fail(); }
}
