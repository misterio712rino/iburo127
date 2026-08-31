import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("scripts/bootstrap-staging-auth-account.ts"), "utf8");
const fixtureRoute = await readFile(resolve("app/%5Fiburo/staging-auth-fixtures/route.ts"), "utf8");
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

// HTTP staging fixture bootstrap contract. This route exists only because the
// release environment cannot execute the reviewed CLI with Vercel-scoped env.
assert.match(fixtureRoute, /export async function GET\(\)/);
assert.match(fixtureRoute, /export async function POST\(request: Request\)/);
assert.match(fixtureRoute, /VERCEL_ENV\?\.trim\(\) === "preview"/);
assert.match(fixtureRoute, /VERCEL_GIT_COMMIT_REF\?\.trim\(\) === VERCEL_STAGING_BRANCH/);
assert.match(fixtureRoute, /IB_RUNTIME_TARGET\?\.trim\(\) === "staging"/);
assert.match(fixtureRoute, /isVercelPreviewBackendAllowed\(env\)/);
assert.match(fixtureRoute, /requireStagingDatabaseTarget\(env\)/);
assert.match(fixtureRoute, /IB_STAGING_BETTER_AUTH_SCHEMA/);
assert.match(fixtureRoute, /IB_STAGING_AUTH_FIXTURE_BOOTSTRAP_CONFIRM/);
assert.match(fixtureRoute, /AUTH-FIXTURES:\$\{databaseName\}:\$\{AUTH_SCHEMA\}/);
assert.match(fixtureRoute, /BOOTSTRAP_AUTH_FIXTURES:\$\{target\.expectedDatabaseName\}:\$\{AUTH_SCHEMA\}:\$\{sha\}/);

for (const [label, email, passwordEnv] of [
  ["CLIENT", "client.individual@example.test", "IB_STAGING_CLIENT_PASSWORD"],
  ["LAWYER", "lawyer.demo@example.test", "IB_STAGING_LAWYER_PASSWORD"],
  ["MANAGER", "manager.demo@example.test", "IB_STAGING_MANAGER_PASSWORD"],
] as const) {
  assert.ok(fixtureRoute.includes(`label: "${label}"`), `${label} fixed fixture label must remain pinned`);
  assert.ok(fixtureRoute.includes(`email: "${email}"`), `${label} fixed fixture email must remain pinned`);
  assert.ok(fixtureRoute.includes(passwordEnv), `${label} fixture must use the reviewed E2E password env`);
  assert.ok(fixtureRoute.includes(`IB_STAGING_${label}_EMAIL`), `${label} fixture email env must be checked`);
}

const clientFixtureBlock = fixtureRoute.slice(
  fixtureRoute.indexOf('label: "CLIENT"'),
  fixtureRoute.indexOf('label: "LAWYER"'),
);
const lawyerFixtureBlock = fixtureRoute.slice(
  fixtureRoute.indexOf('label: "LAWYER"'),
  fixtureRoute.indexOf('label: "MANAGER"'),
);
const managerFixtureBlock = fixtureRoute.slice(
  fixtureRoute.indexOf('label: "MANAGER"'),
  fixtureRoute.indexOf("] as const;"),
);
assert.match(clientFixtureBlock, /allowInternalCreate: false/);
assert.match(lawyerFixtureBlock, /allowInternalCreate: false/);
assert.match(managerFixtureBlock, /allowInternalCreate: true/);

assert.match(fixtureRoute, /BETTER_AUTH_SECRET/);
assert.match(fixtureRoute, /BETTER_AUTH_URL/);
assert.match(fixtureRoute, /hostname === "iburo127\.ru" \|\| hostname\.endsWith\("\.iburo127\.ru"\)/);
assert.match(fixtureRoute, /value\.length < 12/);
assert.match(fixtureRoute, /value\.length > 128/);
assert.match(fixtureRoute, /origin !== requestUrl\.origin && secFetchSite !== "same-origin"/);
assert.doesNotMatch(fixtureRoute, /secFetchSite === "same-site"/);
assert.match(fixtureRoute, /pg_advisory_lock\(hashtext\(\$1\)\)/);
assert.match(fixtureRoute, /pg_advisory_unlock\(hashtext\(\$1\)\)/);

assert.match(fixtureRoute, /disableSignUp: false/);
assert.match(fixtureRoute, /autoSignIn: false/);
assert.match(fixtureRoute, /auth\.api\.signUpEmail/);
assert.match(fixtureRoute, /select id::text as id, status::text as status from "User" where id = \$1::uuid for update/);
assert.match(fixtureRoute, /insert into "AuthIdentity"/);
assert.match(fixtureRoute, /delete from "user" where id = \$1 and lower\(email\) = lower\(\$2\)/);
assert.match(fixtureRoute, /fixture\.allowInternalCreate/);
assert.match(fixtureRoute, /required manager role is missing/);

const getStart = fixtureRoute.indexOf("export async function GET()");
const postStart = fixtureRoute.indexOf("export async function POST(request: Request)");
assert.ok(getStart >= 0 && postStart > getStart, "fixture route must expose GET before POST");
const getHandler = fixtureRoute.slice(getStart, postStart);
assert.doesNotMatch(getHandler, /signUpEmail|insert into|delete from|pg_advisory_lock/i, "GET fixture preflight must not mutate staging state");
assert.match(getHandler, /readPreflight/);
assert.match(getHandler, /configurationReady/);

assert.doesNotMatch(
  fixtureRoute,
  /console\.(?:log|error)\([^\n]*(?:password|secret|subject|email)/i,
  "HTTP fixture bootstrap must not log credentials, subjects or emails",
);
assert.doesNotMatch(
  fixtureRoute,
  /error instanceof Error \? error\.message|String\(error\)|stack/,
  "HTTP fixture bootstrap responses must keep exception details bounded",
);

console.log("STAGING_AUTH_ACCOUNT_BOOTSTRAP_CONTRACT_PASS");
