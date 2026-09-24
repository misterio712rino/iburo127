import type { VercelBlobStorageDriver } from "../server/files/vercel-blob-object-storage";
import { SCANNER_FIXTURE_AUDIENCE } from "../server/staging/scanner-fixture-github-oidc";
import type { ScannerFixtureRequest } from "../server/staging/scanner-fixture-signed-issuer";
import { IB_STAGING_CONTROL_HEADER } from "../server/staging/vercel-automation-auth";
import { isVercelBlobDeleteSuccessStatus } from "../server/files/vercel-blob-delete-semantics";
import { readBoundedScannerJson } from "./staging-scanner-bounded-json";

const EXACT_PREVIEW_ORIGIN = "https://iburo127-app-git-audit-pr-0d0d70-misterio712rino-9166s-projects.vercel.app";
const ROUTE = "/_iburo/staging-scanner-fixture-url";
const MIME = "application/octet-stream";
const MAX_BYTES = 1024;
const ISSUER_DIAGNOSTIC_PATTERN = /^(?:ISSUER_ENV|AUTH_HEADER|REQUEST|OIDC|ISSUER|UPSTREAM)$/;
const fail = (diagnostic?: string): never => {
  throw new Error(diagnostic
    ? `STAGING_SCANNER_OIDC_STORAGE_DENIED:${diagnostic}`
    : "STAGING_SCANNER_OIDC_STORAGE_DENIED");
};
async function boundedControlJson(response: Response, limit: number): Promise<unknown> {
  try {
    const payload = await readBoundedScannerJson(response, limit);
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) fail();
    return payload;
  } catch { return fail(); }
}
const required = (env: NodeJS.ProcessEnv, key: string) => {
  const value = env[key];
  if (!value || /[\r\n\0]/.test(value)) return fail();
  return value;
};

function target(env: NodeJS.ProcessEnv, pathname: string): "clean" | "eicar" {
  if (env.IB_STAGING_BASE_URL !== EXACT_PREVIEW_ORIGIN ||
      env.IB_STAGING_SCANNER_FIXTURE_AUTH_MODE !== "github-oidc") fail();
  const run = `${required(env, "GITHUB_SHA")}/${required(env, "GITHUB_RUN_ID")}-${required(env, "GITHUB_RUN_ATTEMPT")}`;
  const prefix = `security-fixtures/file-scanner/${run}/`;
  if (pathname === `${prefix}clean.txt` && pathname === required(env, "IB_STAGING_FILE_SCANNER_CLEAN_OBJECT_KEY")) return "clean";
  if (pathname === `${prefix}eicar.txt` && pathname === required(env, "IB_STAGING_FILE_SCANNER_MALICIOUS_OBJECT_KEY")) return "eicar";
  return fail();
}
async function githubIdentityToken(env: NodeJS.ProcessEnv, request: typeof fetch) {
  const origin = new URL(required(env, "ACTIONS_ID_TOKEN_REQUEST_URL"));
  const githubActionsOidcHost = /^[a-z0-9-]+\.actions\.githubusercontent\.com$/.test(origin.hostname);
  if (origin.protocol !== "https:" || !githubActionsOidcHost ||
      origin.username || origin.password || origin.port) fail();
  origin.searchParams.set("audience", SCANNER_FIXTURE_AUDIENCE);
  const response = await request(origin.toString(), {
    headers: { authorization: `Bearer ${required(env, "ACTIONS_ID_TOKEN_REQUEST_TOKEN")}` },
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) fail();
  const payload = await boundedControlJson(response, 16_384) as { value?: unknown };
  if (typeof payload.value !== "string" || payload.value.length < 100 || payload.value.length > 12_288) fail();
  return payload.value;
}

export function createOidcScopedScannerSmokeStorage(
  env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch,
): VercelBlobStorageDriver & { confirmUploadedFixture(pathname: string): void } {
  const knownEtags = new Map<string, string>();
  const confirmedUploads = new Set<string>();
  async function issue(pathname: string, operation: ScannerFixtureRequest["operation"], etag?: string) {
    const fixture = target(env, pathname);
    const jwt = await githubIdentityToken(env, request);
    const automationSecret = required(env, "VERCEL_AUTOMATION_BYPASS_SECRET");
    const response = await request(`${EXACT_PREVIEW_ORIGIN}${ROUTE}`, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: {
        authorization: `Bearer ${jwt}`,
        "x-vercel-protection-bypass": automationSecret,
        [IB_STAGING_CONTROL_HEADER]: automationSecret,
        "content-type": "application/json",
      },
      body: JSON.stringify({ fixture, operation, ...(etag ? { etag } : {}) }),
    });
    if (!response.ok) {
      const diagnostic = response.headers.get("x-iburo-staging-scanner-diagnostic");
      if (diagnostic && ISSUER_DIAGNOSTIC_PATTERN.test(diagnostic)) fail(diagnostic);
      fail();
    }
    const payload = await boundedControlJson(response, 8_192) as { url?: unknown; expiresInSeconds?: unknown };
    if (typeof payload.url !== "string" || payload.expiresInSeconds !== 120) fail();
    return payload.url as string;
  }
  function assertIssuedUrl(url: string, pathname: string, operation: ScannerFixtureRequest["operation"]) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { return fail(); }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.hash ||
        !parsed.searchParams.has("vercel-blob-delegation") || !parsed.searchParams.has("vercel-blob-signature")) fail();
    if (operation === "head" || operation === "get") {
      if (parsed.hostname !== required(env, "IB_STAGING_VERCEL_BLOB_PRIVATE_HOST") ||
          parsed.pathname !== `/${pathname}`) fail();
    } else if (parsed.origin !== "https://vercel.com" || parsed.pathname !== "/api/blob/" ||
        parsed.searchParams.get("pathname") !== pathname) fail();
    return url;
  }
  async function signed(pathname: string, operation: ScannerFixtureRequest["operation"], etag?: string) {
    return assertIssuedUrl(await issue(pathname, operation, etag), pathname, operation);
  }
  return {
    confirmUploadedFixture(pathname: string) {
      target(env, pathname);
      confirmedUploads.add(pathname);
    },
    async createPrivateUploadUrl(input) {
      if (input.mimeType !== MIME || input.maximumSizeInBytes < 1 ||
          input.maximumSizeInBytes > MAX_BYTES || input.allowOverwrite) fail();
      return signed(input.pathname, "put");
    },
    async createPrivateDownloadUrl(input) { return signed(input.pathname, "get"); },
    async statPrivateBlob(pathname) {
      const url = await signed(pathname, "head");
      const response = await request(url, { method: "HEAD", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (response.status === 404) return null;
      if (response.status !== 200) fail();
      const length = response.headers.get("content-length") ?? "";
      const mimeType = response.headers.get("content-type");
      const etag = response.headers.get("etag");
      if (!/^\d{1,4}$/.test(length) || Number(length) < 1 || Number(length) > MAX_BYTES ||
          mimeType?.toLowerCase() !== MIME || !etag || !/^(?:"[A-Za-z0-9+\/_=-]{8,128}"|[A-Za-z0-9+\/_=-]{8,128})$/.test(etag)) fail();
      knownEtags.set(pathname, etag as string);
      return { sizeBytes: BigInt(length), mimeType };
    },
    async deletePrivateBlob(pathname) {
      target(env, pathname);
      if (!confirmedUploads.has(pathname)) fail();
      const etag = knownEtags.get(pathname);
      if (!etag) fail();
      const url = await signed(pathname, "delete", etag);
      const response = await request(url, { method: "DELETE", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!isVercelBlobDeleteSuccessStatus(response.status)) fail();
      knownEtags.delete(pathname);
      confirmedUploads.delete(pathname);
    },
  };
}
