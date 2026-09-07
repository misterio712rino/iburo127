import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { VERCEL_BLOB_STORAGE_PROVIDER } from "../server/files/object-storage-provider";
import { assertStagingStorageTarget } from "../scripts/staging-storage-target-guard";
import { verifyVercelBlobStagingAccess } from "../scripts/staging-vercel-blob-verification";

const commitSha = "17833cfeef245e756202011f0d5201fa94fdf69e";
const tokenValue = "vercel_blob_rw_abcd1234_test-secret-value";
const env = {
  IB_OBJECT_STORAGE_PROVIDER: VERCEL_BLOB_STORAGE_PROVIDER,
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "audit/production-readiness",
  VERCEL_GIT_COMMIT_SHA: commitSha,
  IB_RUNTIME_TARGET: "staging",
  IB_STAGING_BASE_URL: "https://stage.iburo.test",
  IB_STORAGE_TARGET: "staging",
  BLOB_READ_WRITE_TOKEN: tokenValue,
} satisfies Record<string, string>;

const target = assertStagingStorageTarget(env);
assert.equal(target.provider, VERCEL_BLOB_STORAGE_PROVIDER);
if (target.provider !== VERCEL_BLOB_STORAGE_PROVIDER) {
  throw new Error("TEST_EXPECTED_VERCEL_BLOB_TARGET");
}
assert.equal(target.commitSha, commitSha);
assert.equal(target.allowedOrigin, "https://stage.iburo.test");
assert.equal(target.auth.mode, "read-write-token");

assert.throws(
  () => assertStagingStorageTarget({ ...env, VERCEL_ENV: "production" }),
  /VERCEL_ENV must equal preview/,
);
assert.throws(
  () => assertStagingStorageTarget({ ...env, VERCEL_GIT_COMMIT_REF: "main" }),
  /VERCEL_GIT_COMMIT_REF must equal audit\/production-readiness/,
);
assert.throws(
  () => assertStagingStorageTarget({ ...env, VERCEL_GIT_COMMIT_SHA: "abc" }),
  /VERCEL_GIT_COMMIT_SHA must be an exact 40-character Git SHA/,
);

const originalFetch = globalThis.fetch;
let signedTokenRequests = 0;
try {
  globalThis.fetch = async (input, init) => {
    signedTokenRequests += 1;
    assert.equal(String(input), "https://vercel.com/api/blob/signed-token");
    assert.equal(init?.method, "POST");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), `Bearer ${tokenValue}`);
    assert.equal(headers.get("x-vercel-blob-store-id"), "abcd1234");

    const body = JSON.parse(String(init?.body)) as {
      pathname: string;
      operations: string[];
      validUntil: number;
    };
    assert.equal(body.pathname, `_iburo/security-fixtures/storage-verifier/${commitSha}.probe`);
    assert.deepEqual(body.operations, ["head"]);

    const delegationPayload = {
      storeId: "abcd1234",
      pathname: body.pathname,
      operations: ["head"],
      validUntil: body.validUntil,
    };
    const delegationToken = `${Buffer.from(JSON.stringify(delegationPayload)).toString("base64url")}.test`;
    return new Response(
      JSON.stringify({
        delegationToken,
        clientSigningToken: "test-client-signing-key",
        validUntil: body.validUntil,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const verification = await verifyVercelBlobStagingAccess(target);
  assert.deepEqual(verification, {
    provider: "vercel-blob",
    signedTokenIssued: true,
    privateHostVerified: true,
    networkAccessed: true,
    valuesPrinted: false,
    objectEnumerationContentOperations: 0,
  });
  assert.equal(signedTokenRequests, 1, "verification must perform only signed-token issuance network access");
} finally {
  globalThis.fetch = originalFetch;
}

const verifierSource = await readFile(resolve("scripts/verify-staging-object-storage.ts"), "utf8");
const routeSource = await readFile(resolve("app/%5Fiburo/staging-storage-verify/route.ts"), "utf8");
const workflowSource = await readFile(resolve(".github/workflows/staging-external-readiness.yml"), "utf8");

const providerBranchIndex = verifierSource.indexOf("target.provider === VERCEL_BLOB_STORAGE_PROVIDER");
const s3ClientIndex = verifierSource.indexOf("new S3Client(");
assert.ok(providerBranchIndex >= 0);
assert.ok(s3ClientIndex > providerBranchIndex, "provider selection must occur before any S3 client construction");
assert.match(verifierSource, /verifyVercelBlobStagingAccess\(target\)/);
assert.match(verifierSource, /Object enumeration\/content operations performed: 0/);
assert.match(verifierSource, /Secret or signed URL values printed: 0/);

assert.match(routeSource, /isVercelPreviewBackendAllowed\(env\)/);
assert.match(routeSource, /x-iburo-staging-storage-confirm/);
assert.match(routeSource, /RUN_STAGING_STORAGE_VERIFY/);
assert.match(routeSource, /verifyVercelBlobStagingAccess\(target\)/);
assert.match(routeSource, /status: 404/);
assert.match(routeSource, /status: 502/);
assert.doesNotMatch(routeSource, /presignedUrl/);
assert.doesNotMatch(routeSource, /delegationToken/);
assert.doesNotMatch(routeSource, /clientSigningToken/);
assert.doesNotMatch(routeSource, /BLOB_READ_WRITE_TOKEN/);

assert.match(workflowSource, /Verify private staging storage/);
assert.match(workflowSource, /_iburo\/staging-storage-verify/);
assert.match(workflowSource, /STAGING_OBJECT_STORAGE_VERIFY_PASS/);
assert.match(workflowSource, /body\.objectEnumerationContentOperations !== 0/);
assert.match(workflowSource, /body\.valuesPrinted !== false/);

console.log("STAGING_VERCEL_BLOB_VERIFIER_CONTRACT_PASS");
