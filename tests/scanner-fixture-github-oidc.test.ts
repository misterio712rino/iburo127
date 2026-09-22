import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  SCANNER_FIXTURE_AUDIENCE,
  SCANNER_FIXTURE_OIDC_DENIED,
  verifyScannerFixtureGitHubOidc,
} from "../server/staging/scanner-fixture-github-oidc";

const sha = "a".repeat(40);
const now = 1_800_000_000_000;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = publicKey.export({ format: "jwk" });
const key = { ...jwk, kid: "test-key", alg: "RS256", use: "sig" };
const claims: Record<string, unknown> = {
  iss: "https://token.actions.githubusercontent.com",
  aud: SCANNER_FIXTURE_AUDIENCE,
  repository: "misterio712rino/iburo127", repository_id: "1303795826",
  ref: "refs/heads/audit/production-readiness", ref_type: "branch",
  workflow_ref: "misterio712rino/iburo127/.github/workflows/staging-file-scanner-smoke.yml@refs/heads/audit/production-readiness",
  event_name: "workflow_dispatch", runner_environment: "github-hosted",
  sha, workflow_sha: sha, run_id: "35735330500", run_attempt: "1",
  iat: now / 1000 - 20, nbf: now / 1000 - 20, exp: now / 1000 + 240,
};
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
function token(payload = claims, header: Record<string, unknown> = { alg: "RS256", kid: "test-key", typ: "JWT" }) {
  const message = `${encode(header)}.${encode(payload)}`;
  return `${message}.${sign("RSA-SHA256", Buffer.from(message), privateKey).toString("base64url")}`;
}
const jwksFetch = async () => Response.json({ keys: [key] });
const validate = (jwt: string, expectedSha = sha, fetchKeys: typeof fetch = jwksFetch) =>
  verifyScannerFixtureGitHubOidc(jwt, expectedSha, fetchKeys, () => now);
const denied = new RegExp(SCANNER_FIXTURE_OIDC_DENIED);

test("accepts only the signed exact run and derives fixture namespace from signed claims", async () => {
  const identity = await validate(token());
  assert.deepEqual(identity, {
    commitSha: sha, runId: "35735330500", runAttempt: "1",
    fixturePrefix: `security-fixtures/file-scanner/${sha}/35735330500-1/`,
  });
});

test("denies unsigned, wrong algorithm, modified signature and wrong candidate SHA", async () => {
  const valid = token();
  const sigStart = valid.lastIndexOf(".") + 1;
  const corrupted = valid.slice(0, sigStart) + (valid[sigStart] === "A" ? "B" : "A") + valid.slice(sigStart + 1);
  for (const invalid of [
    corrupted,
    token(claims, { alg: "none", kid: "test-key" }),
    `${encode({ alg: "RS256", kid: "test-key" })}.${encode(claims)}.AA`,
  ]) await assert.rejects(validate(invalid), denied);
  await assert.rejects(validate(valid, "b".repeat(40)), denied);
});

test("rejects any mismatch in origin, event, repo, branch, workflow and run claims", async () => {
  const variants: Array<Record<string, unknown>> = [
    { iss: "https://attacker.invalid" }, { aud: "wrong" },
    { repository: "attacker/iburo127" }, { repository_id: "1" },
    { ref: "refs/heads/main" }, { ref_type: "tag" },
    { workflow_ref: "misterio712rino/iburo127/.github/workflows/ci.yml@refs/heads/audit/production-readiness" },
    { event_name: "pull_request" }, { runner_environment: "self-hosted" },
    { workflow_sha: "b".repeat(40) }, { run_id: "0" },
    { run_attempt: "1/../../cases" },
  ];
  for (const change of variants) {
    await assert.rejects(validate(token({ ...claims, ...change })), denied, JSON.stringify(change));
  }
});
test("rejects expired, premature and excessive-lifetime assertions", async () => {
  for (const change of [
    { exp: now / 1000 - 1 }, { iat: now / 1000 + 60 },
    { nbf: now / 1000 + 60 }, { exp: now / 1000 + 2000 },
    { iat: "invalid" }, { nbf: undefined },
  ]) await assert.rejects(validate(token({ ...claims, ...change })), denied);
});

test("fails closed on unknown, duplicate and invalid JWKS entries", async () => {
  for (const keys of [[], [key, key], [{ ...key, e: "AQAC" }],
    [{ ...key, kty: "EC" }], [{ ...key, n: "AQAB" }]]) {
    await assert.rejects(validate(token(), sha, async () => Response.json({ keys })), denied);
  }
});

test("rejects unavailable or oversized issuer key response without disclosing tokens", async () => {
  await assert.rejects(validate(token(), sha, async () => new Response(null, { status: 503 })), denied);
  await assert.rejects(validate(token(), sha, async () => new Response("x".repeat(100_001))), denied);
});
