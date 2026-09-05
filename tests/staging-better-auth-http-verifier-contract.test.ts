import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const route = await readFile(
  resolve("app/%5Fiburo/staging-better-auth-verify/route.ts"),
  "utf8",
);
const cliVerifier = await readFile(
  resolve("scripts/verify-staging-better-auth-schema.ts"),
  "utf8",
);

const poolIndex = route.indexOf("new Pool(");
assert.ok(poolIndex > 0, "HTTP verifier must create a database pool only after staging guards");
for (const guard of [
  'env.VERCEL_ENV?.trim() === "preview"',
  "env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH",
  'env.IB_RUNTIME_TARGET?.trim() === "staging"',
  "isVercelPreviewBackendAllowed(env)",
  "requireStagingDatabaseTarget(env)",
  "IB_STAGING_BETTER_AUTH_SCHEMA",
]) {
  const index = route.indexOf(guard);
  assert.ok(index >= 0, `HTTP verifier must contain guard ${guard}`);
  assert.ok(index < poolIndex, `HTTP verifier must enforce ${guard} before DB access`);
}

assert.match(route, /export const dynamic = "force-dynamic"/);
assert.match(route, /export const runtime = "nodejs"/);
assert.match(route, /BEGIN READ ONLY/);
assert.match(route, /ROLLBACK/);
assert.match(route, /readOnly: true/);
assert.match(route, /pass: true/);
assert.match(route, /structuralSha256/);
assert.doesNotMatch(
  route,
  /client\.query(?:<[\s\S]*?>)?\(\s*[`"]\s*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i,
  "HTTP structural verifier must not execute mutating SQL through client.query",
);
assert.doesNotMatch(route, /error\.message|error\.stack|String\(error\)/);

for (const tableName of ["user", "session", "account", "verification", "twoFactor", "rateLimit"]) {
  assert.ok(route.includes(`${tableName}: {`) || route.includes(`"${tableName}"`), `route must verify ${tableName}`);
  assert.ok(cliVerifier.includes(tableName), `CLI verifier must also verify ${tableName}`);
}

for (const criticalColumn of [
  "emailVerified",
  "twoFactorEnabled",
  "accessTokenExpiresAt",
  "refreshTokenExpiresAt",
  "failedVerificationCount",
  "lockedUntil",
  "lastRequest",
]) {
  assert.ok(route.includes(criticalColumn), `route must verify ${criticalColumn}`);
  assert.ok(cliVerifier.includes(criticalColumn), `CLI verifier must verify ${criticalColumn}`);
}

for (const marker of [
  '["user", ["email"]]',
  '["session", ["token"]]',
  '["account", ["issuer", "accountId"]]',
  '["rateLimit", ["key"]]',
  '["session", ["userId"]]',
  '["account", ["userId"]]',
  '["verification", ["identifier"]]',
  '["twoFactor", ["secret"]]',
  '["twoFactor", ["userId"]]',
]) {
  assert.ok(route.includes(marker), `route must retain required index contract ${marker}`);
}

for (const verifierSource of [route, cliVerifier]) {
  assert.match(
    verifierSource,
    /array_agg\(attr\.attname::text order by key_cols\.ordinality\) as columns/,
    "index catalog columns must be normalized to PostgreSQL text[] for deterministic pg decoding",
  );
  assert.doesNotMatch(
    verifierSource,
    /array_agg\(attr\.attname order by key_cols\.ordinality\) as columns/,
    "raw PostgreSQL name[] index columns must not be used",
  );
}

assert.match(route, /constraint_type = 'PRIMARY KEY'/);
assert.match(route, /constraint_type = 'FOREIGN KEY'/);
assert.match(route, /row\.delete_rule === "CASCADE"/);
for (const tableName of ["session", "account", "twoFactor"]) {
  assert.ok(route.includes(`"${tableName}"`), `${tableName} cascading user FK must remain represented`);
}

const successRollbackIndex = route.indexOf('await client.query("ROLLBACK")');
const passIndex = route.indexOf("pass: true");
assert.ok(
  successRollbackIndex >= 0 && passIndex > successRollbackIndex,
  "HTTP verifier must rollback the success-path read-only transaction before reporting PASS",
);

console.log("STAGING_BETTER_AUTH_HTTP_VERIFIER_CONTRACT_PASS");
