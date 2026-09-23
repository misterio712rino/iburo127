import assert from "node:assert/strict";
import test from "node:test";
import { issueScannerFixtureSignedUrl, SCANNER_FIXTURE_ISSUER_DENIED } from "../server/staging/scanner-fixture-signed-issuer";
import type { VercelBlobSignedUrlDependencies } from "../server/files/vercel-blob-signed-url-driver";
import type { ScannerFixtureRunIdentity } from "../server/staging/scanner-fixture-github-oidc";

const sha = "a".repeat(40);
const host = "teststore123.private.blob.vercel-storage.com";
const prefix = `security-fixtures/file-scanner/${sha}/12345-1/`;
const env = {
  IB_STAGING_SCANNER_FIXTURE_ISSUER_ENABLED: "true", VERCEL_ENV: "preview",
  IB_RUNTIME_TARGET: "staging", IB_STORAGE_TARGET: "staging",
  VERCEL_GIT_COMMIT_REF: "audit/production-readiness", VERCEL_GIT_COMMIT_SHA: sha,
  VERCEL_GIT_PROVIDER: "github", VERCEL_GIT_REPO_OWNER: "misterio712rino",
  VERCEL_GIT_REPO_SLUG: "iburo127", VERCEL_GIT_REPO_ID: "1303795826",
  IB_STAGING_VERCEL_BLOB_PRIVATE_HOST: host,
};
const identity: ScannerFixtureRunIdentity = { commitSha: sha, runId: "12345", runAttempt: "1", fixturePrefix: prefix };
const verify = async (_jwt: string, expected: string) => {
  assert.equal(expected, sha);
  return identity;
};
const jwt = "x".repeat(200);
const denied = (error: unknown) => error instanceof Error && error.message === SCANNER_FIXTURE_ISSUER_DENIED;
function harness(headStatus = 404, headEtag = '"0123456789abcdef0123456789abcdef"', signedHost = host) {
  const operations: string[] = [];
  let credentialCalls = 0;
  const deps: VercelBlobSignedUrlDependencies = {
    now: () => 1_800_000_000_000,
    issueSignedToken: async (input) => {
      operations.push(`issue:${input.operations[0]}:${input.pathname}`);
      assert.equal(input.pathname.startsWith(prefix), true);
      assert.deepEqual(input.operations.length, 1);
      return { delegationToken: "delegation", clientSigningToken: "signer", validUntil: input.validUntil };
    },
    presignUrl: async (_token, input) => {
      operations.push(`presign:${input.operation}:${input.ifMatch ?? ""}`);
      const target = input.operation === "head" || input.operation === "get"
        ? `https://${signedHost}/${input.pathname}`
        : `https://vercel.com/api/blob/?pathname=${encodeURIComponent(input.pathname)}`;
      return { presignedUrl: `${target}${target.includes("?") ? "&" : "?"}vercel-blob-delegation=d&vercel-blob-signature=s` };
    },
    request: async (_url, init) => {
      assert.equal(init?.method, "HEAD");
      operations.push("head-request");
      return new Response(null, { status: headStatus, headers: { etag: headEtag } });
    },
  };
  const credentials = () => { credentialCalls++; return { token: "unprinted-staging-placeholder" }; };
  return { deps, credentials, operations, count: () => credentialCalls };
}
test("disabled or wrong Preview identity denies before credential access", async () => {
  for (const override of [
    { IB_STAGING_SCANNER_FIXTURE_ISSUER_ENABLED: "false" }, { VERCEL_ENV: "production" },
    { IB_STORAGE_TARGET: "production" }, { VERCEL_GIT_COMMIT_REF: "main" },
    { VERCEL_GIT_REPO_ID: "1" }, { IB_STAGING_VERCEL_BLOB_PRIVATE_HOST: "attacker.invalid" },
  ]) {
    const h = harness();
    await assert.rejects(issueScannerFixtureSignedUrl({ fixture: "clean", operation: "put" }, jwt,
      { ...env, ...override }, h.credentials, h.deps, verify), denied);
    assert.equal(h.count(), 0);
    assert.deepEqual(h.operations, []);
  }
});

test("rejects unsupported fixture and ETag misuse without calling Blob", async () => {
  const invalid = [
    { fixture: "../cases/customer", operation: "put" },
    { fixture: "clean", operation: "put", etag: "x" },
    { fixture: "eicar", operation: "delete" },
    { fixture: "clean", operation: "delete", etag: "bad\r\netag" },
  ];
  for (const input of invalid) {
    const h = harness();
    await assert.rejects(issueScannerFixtureSignedUrl(input as never, jwt,
      env, h.credentials, h.deps, verify), denied);
    assert.equal(h.count(), 0);
  }
});
test("refuses occupied or unverifiable upload paths", async () => {
  for (const status of [200, 403, 500]) {
    const h = harness(status);
    await assert.rejects(issueScannerFixtureSignedUrl({ fixture: "clean", operation: "put" }, jwt,
      env, h.credentials, h.deps, verify), denied);
    assert.deepEqual(h.operations.filter((operation) => operation.startsWith("issue:put")), []);
  }
});

test("issues only bounded PUT URL after exact-path absence check", async () => {
  const h = harness();
  const result = await issueScannerFixtureSignedUrl({ fixture: "eicar", operation: "put" }, jwt,
    env, h.credentials, h.deps, verify);
  assert.equal(new URL(result.url).searchParams.get("pathname"), `${prefix}eicar.txt`);
  assert.equal(result.expiresInSeconds, 120);
  assert.deepEqual(h.operations.map((entry) => entry.split(":")[0]),
    ["issue", "presign", "head-request", "issue", "presign"]);
  assert.equal(h.count(), 1);
  assert.ok(!JSON.stringify(result).includes("unprinted-staging-placeholder"));
});

test("conditional delete requires matching current ETag", async () => {
  const etag = '"0123456789abcdef0123456789abcdef"';
  for (const [status, provided] of [[404, etag], [200, '"ffffffffffffffffffffffffffffffff"']] as const) {
    const h = harness(status);
    await assert.rejects(issueScannerFixtureSignedUrl({ fixture: "clean", operation: "delete", etag: provided },
      jwt, env, h.credentials, h.deps, verify), denied);
    assert.ok(!h.operations.some((entry) => entry.startsWith("issue:delete")));
  }
  const h = harness(200);
  const result = await issueScannerFixtureSignedUrl({ fixture: "clean", operation: "delete", etag },
    jwt, env, h.credentials, h.deps, verify);
  assert.ok(h.operations.includes(`presign:delete:${etag}`));
  assert.ok(result.url.includes("vercel-blob-signature="));
});
test("never returns signed URLs pointing to a different private store", async () => {
  const h = harness(404, undefined, "attacker.private.blob.vercel-storage.com");
  await assert.rejects(issueScannerFixtureSignedUrl({ fixture: "clean", operation: "get" }, jwt,
    env, h.credentials, h.deps, verify), denied);
});

test("OIDC failure stops before credentials or signing", async () => {
  const h = harness();
  await assert.rejects(issueScannerFixtureSignedUrl({ fixture: "clean", operation: "get" }, jwt,
    env, h.credentials, h.deps, async () => { throw new Error("OIDC_REJECTED"); }), /OIDC_REJECTED/);
  assert.equal(h.count(), 0);
  assert.deepEqual(h.operations, []);
});
