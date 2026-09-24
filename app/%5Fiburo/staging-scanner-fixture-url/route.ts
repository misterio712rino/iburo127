import { NextResponse } from "next/server";
import { VERCEL_STAGING_BRANCH, isVercelPreviewBackendAllowed } from "@/server/config/vercel-preview-boundary";
import {
  readVercelBlobAuthConfig,
  VERCEL_BLOB_CONFIG_ERROR,
} from "@/server/files/vercel-blob-config";
import { toVercelBlobSdkCredentialOptions } from "@/server/files/vercel-blob-driver-auth";
import {
  createVercelBlobNativeSignedUrlDependencies,
  VERCEL_BLOB_NATIVE_BINDING_ERROR,
} from "@/server/files/vercel-blob-native-signed-url";
import { SCANNER_FIXTURE_OIDC_DENIED } from "@/server/staging/scanner-fixture-github-oidc";
import {
  assertScannerFixtureIssuerPreview, issueScannerFixtureSignedUrl,
  SCANNER_FIXTURE_ISSUER_DENIED,
  type ScannerFixtureRequest,
} from "@/server/staging/scanner-fixture-signed-issuer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex",
};
function isExactStagingPreview(env: NodeJS.ProcessEnv) {
  const sha = env.VERCEL_GIT_COMMIT_SHA?.trim() ?? "";
  return (
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    /^[a-f0-9]{40}$/i.test(sha) &&
    isVercelPreviewBackendAllowed(env)
  );
}
type ScannerFixtureDiagnostic =
  | "ISSUER_ENV" | "AUTH_HEADER" | "REQUEST" | "OIDC" | "ISSUER"
  | "BLOB_CONFIG" | "BLOB_NATIVE" | "BLOB_NATIVE_STORE_ID" | "BLOB_NATIVE_CREDENTIALS"
  | "BLOB_NATIVE_TOKEN_FORMAT" | "BLOB_NATIVE_TOKEN_RESPONSE" | "BLOB_NATIVE_SCOPE"
  | "BLOB_NATIVE_CONSTRAINT" | "BLOB_NATIVE_EXPIRED" | "UPSTREAM_NETWORK" | "UPSTREAM"
  | "BLOB_SIGNED_TOKEN_HTTP_400" | "BLOB_SIGNED_TOKEN_HTTP_401"
  | "BLOB_SIGNED_TOKEN_HTTP_403" | "BLOB_SIGNED_TOKEN_HTTP_404"
  | "BLOB_SIGNED_TOKEN_HTTP_409" | "BLOB_SIGNED_TOKEN_HTTP_429"
  | "BLOB_SIGNED_TOKEN_HTTP_500" | "BLOB_SIGNED_TOKEN_HTTP_502"
  | "BLOB_SIGNED_TOKEN_HTTP_503" | "BLOB_SIGNED_TOKEN_HTTP_504";
const DIAGNOSTIC_HEADER = "X-Iburo-Staging-Scanner-Diagnostic";
function unavailable(reason?: ScannerFixtureDiagnostic) {
  return NextResponse.json(
    { available: false },
    { status: 404, headers: reason ? { ...HEADERS, [DIAGNOSTIC_HEADER]: reason } : HEADERS },
  );
}
function safeIssueReason(error: unknown): ScannerFixtureDiagnostic {
  if (!(error instanceof Error)) return "UPSTREAM";
  if (error.message === SCANNER_FIXTURE_OIDC_DENIED) return "OIDC";
  if (error.message === SCANNER_FIXTURE_ISSUER_DENIED) return "ISSUER";
  if (error.message.startsWith(`${VERCEL_BLOB_CONFIG_ERROR}:`)) return "BLOB_CONFIG";
  const nativePrefix = `${VERCEL_BLOB_NATIVE_BINDING_ERROR}:`;
  if (error.message.startsWith(nativePrefix)) {
    const reason = error.message.slice(nativePrefix.length);
    const match = /^signed-token-http-(400|401|403|404|409|429|500|502|503|504)$/.exec(reason);
    if (match) return `BLOB_SIGNED_TOKEN_HTTP_${match[1]}` as ScannerFixtureDiagnostic;
    if (reason === "invalid-store-id") return "BLOB_NATIVE_STORE_ID";
    if (reason === "missing-credentials") return "BLOB_NATIVE_CREDENTIALS";
    if (reason === "invalid-delegation-token" || reason === "invalid-delegation-payload") {
      return "BLOB_NATIVE_TOKEN_FORMAT";
    }
    if (reason === "signed-token-response-too-large" || reason === "invalid-signed-token-response") {
      return "BLOB_NATIVE_TOKEN_RESPONSE";
    }
    if (reason === "delegation-scope-mismatch" || reason === "pathname-outside-delegation" ||
        reason === "operation-outside-delegation") return "BLOB_NATIVE_SCOPE";
    if (reason === "invalid-conditional-etag" || reason === "content-type-outside-delegation" ||
        reason === "size-outside-delegation") return "BLOB_NATIVE_CONSTRAINT";
    if (reason === "expired-presign" || reason === "delegation-expired") return "BLOB_NATIVE_EXPIRED";
    return "BLOB_NATIVE";
  }
  if (error.name === "AbortError" || error.name === "TimeoutError" || error instanceof TypeError) {
    return "UPSTREAM_NETWORK";
  }
  return "UPSTREAM";
}
async function readBoundedJson(request: Request): Promise<ScannerFixtureRequest> {
  const reported = request.headers.get("content-length");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json" ||
      (reported !== null && (!/^\d+$/.test(reported) || Number(reported) > 1024)) ||
      !request.body) throw new Error("invalid fixture request");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytes += value.byteLength;
      if (bytes > 1024) throw new Error("oversized fixture request");
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const raw = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid fixture request");
  const fields = Object.keys(parsed);
  if (fields.some((field) => !["fixture", "operation", "etag"].includes(field)) ||
      fields.length < 2 || fields.length > 3) throw new Error("invalid fixture request");
  return parsed as ScannerFixtureRequest;
}

export async function POST(request: Request) {
  const env = process.env;
  if (!isExactStagingPreview(env)) return unavailable();
  try {
    assertScannerFixtureIssuerPreview(env);
  } catch {
    return unavailable("ISSUER_ENV");
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 12_300) {
    return unavailable("AUTH_HEADER");
  }
  let input: ScannerFixtureRequest;
  try {
    input = await readBoundedJson(request);
  } catch {
    return unavailable("REQUEST");
  }
  try {
    const result = await issueScannerFixtureSignedUrl(input, authorization.slice(7),
      env, () => toVercelBlobSdkCredentialOptions(readVercelBlobAuthConfig()),
      createVercelBlobNativeSignedUrlDependencies());
    return NextResponse.json(result, { status: 200, headers: HEADERS });
  } catch (error) {
    return unavailable(safeIssueReason(error));
  }
}
