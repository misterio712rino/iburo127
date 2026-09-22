import { createPublicKey, verify } from "node:crypto";

// This module only validates identity. It does not issue Blob URLs or read credentials.
export const SCANNER_FIXTURE_OIDC_DENIED = "STAGING_SCANNER_OIDC_DENIED";
export const SCANNER_FIXTURE_AUDIENCE = "iburo-staging-file-scanner-fixtures-v1";
const ISSUER = "https://token.actions.githubusercontent.com";
const JWKS_URL = `${ISSUER}/.well-known/jwks`;
const REPOSITORY = "misterio712rino/iburo127";
const REPOSITORY_ID = "1303795826";
const REF = "refs/heads/audit/production-readiness";
const WORKFLOW_REF = `${REPOSITORY}/.github/workflows/staging-file-scanner-smoke.yml@${REF}`;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const POSITIVE_INTEGER = /^[1-9][0-9]{0,19}$/;
const JWT_SEGMENT = /^[A-Za-z0-9_-]+$/;
const MAX_JWT_LENGTH = 12_288;
const MAX_JWKS_BYTES = 100_000;

export type ScannerFixtureRunIdentity = Readonly<{
  commitSha: string;
  runId: string;
  runAttempt: string;
  fixturePrefix: string;
}>;

function deny(): never {
  throw new Error(SCANNER_FIXTURE_OIDC_DENIED);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) deny();
  return value as Record<string, unknown>;
}
function parseSegment(segment: string): Record<string, unknown> {
  if (!JWT_SEGMENT.test(segment) || segment.length > 8192) deny();
  try {
    return asObject(JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as unknown);
  } catch {
    return deny();
  }
}

function requireClaims(payload: Record<string, unknown>, expectedCommitSha: string, now: number) {
  const seconds = Math.floor(now / 1000);
  const issuedAt = payload.iat;
  const notBefore = payload.nbf;
  const expiresAt = payload.exp;
  if (
    payload.iss !== ISSUER || payload.aud !== SCANNER_FIXTURE_AUDIENCE ||
    payload.repository !== REPOSITORY || payload.repository_id !== REPOSITORY_ID ||
    payload.ref !== REF || payload.ref_type !== "branch" ||
    payload.workflow_ref !== WORKFLOW_REF || payload.event_name !== "workflow_dispatch" ||
    payload.sha !== expectedCommitSha || payload.workflow_sha !== expectedCommitSha ||
    payload.runner_environment !== "github-hosted" ||
    typeof issuedAt !== "number" || !Number.isInteger(issuedAt) ||
    typeof notBefore !== "number" || !Number.isInteger(notBefore) ||
    typeof expiresAt !== "number" || !Number.isInteger(expiresAt) ||
    issuedAt > seconds + 30 || notBefore > seconds + 30 ||
    expiresAt <= seconds || expiresAt <= issuedAt || expiresAt - issuedAt > 600
  ) deny();
  if (typeof payload.run_id !== "string" || !POSITIVE_INTEGER.test(payload.run_id) ||
      typeof payload.run_attempt !== "string" || !POSITIVE_INTEGER.test(payload.run_attempt)) deny();
  return { runId: payload.run_id, runAttempt: payload.run_attempt };
}
async function getVerificationKey(kid: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl(JWKS_URL, {
    method: "GET", cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });
  const reportedSize = response.headers.get("content-length");
  if (!response.ok || (reportedSize !== null &&
      (!/^\d+$/.test(reportedSize) || Number(reportedSize) > MAX_JWKS_BYTES))) deny();
  // Fixed GitHub TLS origin; bound the response even without Content-Length.
  if (!response.body) deny();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_JWKS_BYTES) deny();
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const jwks = asObject(JSON.parse(body.toString("utf8")) as unknown);
  if (!Array.isArray(jwks.keys) || jwks.keys.length > 25) deny();
  const matches = jwks.keys.filter((key: unknown) => {
    const entry = asObject(key);
    return entry.kid === kid && entry.kty === "RSA" &&
      (entry.alg === undefined || entry.alg === "RS256") &&
      (entry.use === undefined || entry.use === "sig");
  });
  if (matches.length !== 1) deny();
  const selected = asObject(matches[0]);
  if (typeof selected.n !== "string" || !JWT_SEGMENT.test(selected.n) ||
      Buffer.from(selected.n, "base64url").length < 256 ||
      selected.e !== "AQAB") deny();
  return createPublicKey({ key: { kty: "RSA", n: selected.n, e: selected.e }, format: "jwk" });
}
export async function verifyScannerFixtureGitHubOidc(
  token: string,
  expectedCommitSha: string,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<ScannerFixtureRunIdentity> {
  if (!SHA_PATTERN.test(expectedCommitSha) || typeof token !== "string" ||
      token.length > MAX_JWT_LENGTH || token.length < 100) deny();
  const segments = token.split(".");
  if (segments.length !== 3 || segments.some((segment) => !JWT_SEGMENT.test(segment))) deny();
  try {
    const header = parseSegment(segments[0]);
    if (header.alg !== "RS256" || typeof header.kid !== "string" ||
        !/^[A-Za-z0-9._-]{1,128}$/.test(header.kid) ||
        (header.typ !== undefined && header.typ !== "JWT")) deny();
    const key = await getVerificationKey(header.kid, fetchImpl);
    const valid = verify("RSA-SHA256", Buffer.from(`${segments[0]}.${segments[1]}`),
      key, Buffer.from(segments[2], "base64url"));
    if (!valid) deny();
    const claims = parseSegment(segments[1]);
    const identity = requireClaims(claims, expectedCommitSha, now());
    return {
      commitSha: expectedCommitSha,
      ...identity,
      fixturePrefix: `security-fixtures/file-scanner/${expectedCommitSha}/${identity.runId}-${identity.runAttempt}/`,
    };
  } catch {
    return deny();
  }
}
