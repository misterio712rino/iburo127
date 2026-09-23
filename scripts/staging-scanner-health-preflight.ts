// Run before issuing any Blob fixture capability or uploading synthetic data.
export const STAGING_SCANNER_HEALTH_DENIED = "STAGING_SCANNER_HEALTH_DENIED";
const ORIGIN = "https://scanner-v2-staging.iburo127.online";
const MAX_HEALTH_BYTES = 128;
const MAX_HEALTH_ATTEMPTS = 4;
const HEALTH_RETRY_DELAY_MS = 1_000;
const fail = (): never => { throw new Error(STAGING_SCANNER_HEALTH_DENIED); };
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function validateHealthResponse(response: Response): Promise<void> {
  if (response.status !== 200 ||
      response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") fail();
  const advertised = response.headers.get("content-length");
  if (advertised !== null && (!/^\d{1,3}$/.test(advertised) || Number(advertised) > MAX_HEALTH_BYTES)) fail();
  const healthStream = response.body;
  if (healthStream === null) fail();
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
}

export async function verifyAuthorizedStagingScannerHealth(
  origin: string,
  secret: string,
  request: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = delay,
): Promise<void> {
  if (origin !== ORIGIN || typeof secret !== "string" || secret.length < 32 ||
      /[\r\n\0]/.test(secret)) fail();

  for (let attempt = 1; attempt <= MAX_HEALTH_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await request(`${ORIGIN}/health`, {
        method: "GET",
        headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
        redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000),
      });
    } catch {
      if (attempt === MAX_HEALTH_ATTEMPTS) fail();
      await wait(HEALTH_RETRY_DELAY_MS);
      continue;
    }

    if (response.status >= 500 && response.status <= 599) {
      await response.body?.cancel().catch(() => {});
      if (attempt === MAX_HEALTH_ATTEMPTS) fail();
      await wait(HEALTH_RETRY_DELAY_MS);
      continue;
    }

    try {
      await validateHealthResponse(response);
      return;
    } catch {
      fail();
    }
  }

  fail();
}
