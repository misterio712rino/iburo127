import type { VercelBlobSdkCredentialOptions } from "../files/vercel-blob-driver-auth";
import type { VercelBlobSignedUrlDependencies } from "../files/vercel-blob-signed-url-driver";
import { isVercelPreviewBackendAllowed } from "../config/vercel-preview-boundary";
import { verifyScannerFixtureGitHubOidc } from "./scanner-fixture-github-oidc";

export const SCANNER_FIXTURE_ISSUER_DENIED = "STAGING_SCANNER_FIXTURE_ISSUER_DENIED";
const HOST_PATTERN = /^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const ETAG_PATTERN = /^(?:"[A-Za-z0-9+\/_=-]{8,128}"|[A-Za-z0-9+\/_=-]{8,128})$/;
const URL_TTL_MS = 120_000;
const MAX_FIXTURE_BYTES = 1024;
type Operation = "put" | "get" | "head" | "delete";
export type ScannerFixtureRequest = { fixture: "clean" | "eicar"; operation: Operation; etag?: string };
type Env = Readonly<Record<string, string | undefined>>;
function deny(): never { throw new Error(SCANNER_FIXTURE_ISSUER_DENIED); }

export function assertScannerFixtureIssuerPreview(env: Env): { sha: string; privateHost: string } {
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase() ?? "";
  const privateHost = env.IB_STAGING_VERCEL_BLOB_PRIVATE_HOST?.trim() ?? "";
  if (env.IB_STAGING_SCANNER_FIXTURE_ISSUER_ENABLED !== "true" ||
      env.VERCEL_ENV !== "preview" || env.IB_RUNTIME_TARGET !== "staging" ||
      env.IB_STORAGE_TARGET !== "staging" || env.VERCEL_GIT_COMMIT_REF !== "audit/production-readiness" ||
      !isVercelPreviewBackendAllowed(env) || !SHA_PATTERN.test(sha) ||
      !HOST_PATTERN.test(privateHost)) deny();
  return { sha, privateHost };
}
export async function issueScannerFixtureSignedUrl(
  request: ScannerFixtureRequest,
  githubOidc: string,
  env: Env,
  credentials: () => VercelBlobSdkCredentialOptions,
  dependencies: VercelBlobSignedUrlDependencies,
  verifyOidc: typeof verifyScannerFixtureGitHubOidc = verifyScannerFixtureGitHubOidc,
) {
  const { sha, privateHost } = assertScannerFixtureIssuerPreview(env);
  if (!request || (request.fixture !== "clean" && request.fixture !== "eicar") ||
      !["put", "get", "head", "delete"].includes(request.operation) ||
      typeof githubOidc !== "string" || githubOidc.length < 100) deny();
  if (request.operation === "delete") {
    if (!request.etag || !ETAG_PATTERN.test(request.etag)) deny();
  } else if (request.etag !== undefined) deny();

  const identity = await verifyOidc(githubOidc, sha);
  const pathname = `${identity.fixturePrefix}${request.fixture === "clean" ? "clean.txt" : "eicar.txt"}`;
  const expiresAt = (dependencies.now ?? Date.now)() + URL_TTL_MS;
  const signedCredentials = credentials();
  const sign = async (operation: Operation, etag?: string) => {
    const token = await dependencies.issueSignedToken({
      ...signedCredentials, pathname, operations: [operation], validUntil: expiresAt,
      ...(operation === "put" ? { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: MAX_FIXTURE_BYTES } : {}),
    });
    const result = await dependencies.presignUrl(token, {
      operation, pathname, access: "private", validUntil: expiresAt,
      ...(operation === "get" ? { useCache: false } : {}),
      ...(operation === "put" ? { allowedContentTypes: ["application/pdf"], maximumSizeInBytes: MAX_FIXTURE_BYTES, addRandomSuffix: false, allowOverwrite: false } : {}),
      ...(etag ? { ifMatch: etag } : {}),
    });
    return result.presignedUrl;
  };
  const checkedUrl = (raw: string, operation: Operation) => {
    let parsed: URL;
    try { parsed = new URL(raw); } catch { return deny(); }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.hash ||
        !parsed.searchParams.has("vercel-blob-delegation") ||
        !parsed.searchParams.has("vercel-blob-signature")) deny();
    if (operation === "get" || operation === "head") {
      if (parsed.hostname !== privateHost || parsed.pathname !== `/${pathname}`) deny();
    } else if (parsed.origin !== "https://vercel.com" || parsed.pathname !== "/api/blob/" ||
        parsed.searchParams.get("pathname") !== pathname) deny();
    return raw;
  };
  if (request.operation === "put" || request.operation === "delete") {
    const head = checkedUrl(await sign("head"), "head");
    const response = await dependencies.request(head, {
      method: "HEAD", redirect: "error", signal: AbortSignal.timeout(5_000), cache: "no-store",
    });
    if (request.operation === "put") {
      if (response.status !== 404) deny(); // Never overwrite a pre-existing fixture.
    } else if (response.status !== 200 || response.headers.get("etag") !== request.etag) {
      deny(); // Conditional DELETE also protects against replacement after this HEAD.
    }
  }
  const url = checkedUrl(await sign(request.operation, request.etag), request.operation);
  return { url, expiresInSeconds: URL_TTL_MS / 1000 };
}
