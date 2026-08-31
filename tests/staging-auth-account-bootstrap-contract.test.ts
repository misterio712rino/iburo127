import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("scripts/bootstrap-staging-auth-account.ts"), "utf8");
const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};

const bootstrapScript = packageJson.scripts?.["auth:bootstrap:staging"] ?? "";
assert.match(bootstrapScript, /db:check:migrations/);
assert.match(bootstrapScript, /check:staging:auth-schema/);
assert.match(bootstrapScript, /bootstrap-staging-auth-account\.ts/);

const linkScript = packageJson.scripts?.["auth:link:staging"] ?? "";
assert.match(linkScript, /node --conditions=react-server --import tsx scripts\/provision-auth-identity\.ts/);

const preflightIndex = source.indexOf("requireReviewedStagingMutationPreflight({");
const poolIndex = source.indexOf("new Pool({");
const authIndex = source.indexOf("betterAuth({");
assert.ok(preflightIndex >= 0, "bootstrap must use the reviewed staging mutation preflight");
assert.ok(poolIndex > preflightIndex, "bootstrap must pass preflight before opening its operational Pool");
assert.ok(authIndex > poolIndex, "bootstrap Better Auth instance must be created only after staging preflight");

assert.match(source, /IB_AUTH_BOOTSTRAP_CONFIRM/);
assert.match(source, /BOOTSTRAP-AUTH:\$\{stagingTarget\.expectedDatabaseName\}:\$\{userId\}/);
assert.match(source, /IB_STAGING_BETTER_AUTH_SCHEMA/);
assert.match(source, /authSchema !== "public"/);
assert.match(source, /production Better Auth hostname is explicitly blocked/);

assert.match(source, /select id, status, email, "displayName" from "User"/);
assert.match(source, /domainUser\.status !== "ACTIVE"/);
assert.match(source, /IB_AUTH_BOOTSTRAP_EMAIL does not match the internal User email/);

const providerIdentityQuery = /select subject from "AuthIdentity" where "userId" = \$1::uuid and provider = \$2 limit 1/g;
assert.equal(
  source.match(providerIdentityQuery)?.length,
  2,
  "bootstrap must reject an existing Better Auth identity both before account creation and after locking the User",
);
assert.match(source, /internal User already has a Better Auth identity/);
assert.match(source, /internal User acquired a Better Auth identity during bootstrap/);

assert.match(source, /select id, email from "user" where lower\(email\) = lower\(\$1\)/);
assert.match(source, /Better Auth account already exists for the requested email/);

assert.match(source, /disableSignUp: false/);
assert.match(source, /autoSignIn: false/);
assert.match(source, /auth\.api\.signUpEmail/);
assert.match(source, /persisted\.id !== returnedSubject/);
assert.match(source, /createdSubject = persisted\.id/);

const userLockIndex = source.indexOf('select id, status from "User" where id = $1::uuid for update');
const racedProviderIdentityIndex = source.indexOf("internal User acquired a Better Auth identity during bootstrap");
const insertIdentityIndex = source.indexOf('insert into "AuthIdentity"');
assert.ok(userLockIndex >= 0, "bootstrap must lock the internal User before the final identity link");
assert.ok(
  racedProviderIdentityIndex > userLockIndex,
  "bootstrap must re-check provider identity after acquiring the User lock",
);
assert.ok(
  insertIdentityIndex > racedProviderIdentityIndex,
  "bootstrap must reject a raced provider identity before inserting AuthIdentity",
);

assert.match(source, /select "userId" from "AuthIdentity" where provider = \$1 and subject = \$2/);
assert.match(source, /insert into "AuthIdentity"/);
assert.match(source, /PROVIDER = "better-auth"/);
assert.match(source, /delete from "user" where id = \$1 and lower\(email\) = lower\(\$2\)/);
assert.match(source, /STAGING_AUTH_ACCOUNT_BOOTSTRAP_PASS/);

assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:password|createdSubject|returnedSubject|email)\b/);

console.log("STAGING_AUTH_ACCOUNT_BOOTSTRAP_CONTRACT_PASS");
