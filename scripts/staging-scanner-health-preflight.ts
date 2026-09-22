// Run before issuing any Blob fixture capability or uploading synthetic data.
export const STAGING_SCANNER_HEALTH_DENIED = "STAGING_SCANNER_HEALTH_DENIED";
const ORIGIN = "https://scanner-v2-staging.iburo127.online";
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
    const body = await response.text();
    if (body.length > 128) fail();
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
        Object.keys(parsed).length !== 1 || (parsed as { status?: unknown }).status !== "ok") fail();
  } catch { fail(); }
}
