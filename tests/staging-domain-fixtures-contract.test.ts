import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const route = await readFile(
  resolve("app/%5Fiburo/staging-domain-fixtures/route.ts"),
  "utf8",
);
const helper = await readFile(resolve("server/staging/domain-fixtures.ts"), "utf8");
const referenceSeed = await readFile(resolve("prisma/seed.ts"), "utf8");
const demoSeed = await readFile(resolve("prisma/seed-demo.ts"), "utf8");

assert.match(route, /VERCEL_STAGING_BRANCH/, "domain fixture route must be branch-bound");
assert.match(
  route,
  /isVercelPreviewBackendAllowed\(env\)/,
  "domain fixture route must require the exact SHA-bound Preview backend confirmation",
);
assert.match(
  route,
  /env\.IB_RUNTIME_TARGET\?\.trim\(\) === "staging"/,
  "domain fixture route must remain staging-only",
);
assert.match(
  route,
  /IB_STAGING_REFERENCE_SEED_CONFIRM/,
  "domain fixture route must require the existing reference seed confirmation",
);
assert.match(
  route,
  /IB_STAGING_DEMO_SEED_CONFIRM/,
  "domain fixture route must require the existing demo seed confirmation",
);
assert.match(
  route,
  /`REFERENCE-SEED:\$\{databaseName\}`/,
  "reference confirmation format must stay aligned with the CLI seed",
);
assert.match(
  route,
  /`DEMO-SEED:\$\{databaseName\}`/,
  "demo confirmation format must stay aligned with the CLI seed",
);

const postIndex = route.indexOf("export async function POST");
const originIndex = route.indexOf('request.headers.get("origin")', postIndex);
const confirmationIndex = route.indexOf('formData.get("confirm")', postIndex);
const lockPoolIndex = route.indexOf("new Pool(", postIndex);
assert.ok(postIndex >= 0, "domain fixture route must expose an explicit POST mutation path");
assert.ok(originIndex > postIndex, "POST must inspect Origin before database mutation access");
assert.match(
  route.slice(postIndex),
  /secFetchSite !== "same-origin"/,
  "only same-origin Fetch Metadata may satisfy the browser fallback",
);
assert.equal(
  route.slice(postIndex).includes('secFetchSite === "same-site"'),
  false,
  "same-site must not satisfy the domain fixture CSRF guard",
);
assert.ok(confirmationIndex > originIndex, "per-SHA confirmation must remain after the origin guard");
assert.ok(lockPoolIndex > confirmationIndex, "database mutation access must remain after origin and confirmation guards");
assert.match(
  route,
  /SEED_DOMAIN_FIXTURES:\$\{target\.expectedDatabaseName\}:\$\{SCHEMA\}:\$\{sha\}/,
  "POST must require a database/schema/exact-SHA request confirmation",
);
assert.match(route, /pg_advisory_lock/, "domain fixture POST must serialize seeding with an advisory lock");
assert.match(route, /prisma\.\$transaction/, "reference and demo seed must execute in one Prisma transaction");
assert.ok(
  route.indexOf("seedReferenceData(tx)", postIndex) < route.indexOf("seedDemoData(tx)", postIndex),
  "reference data must be seeded before demo rows",
);
assert.match(route, /inspectDomainFixtures\(tx\)/, "POST must verify the seeded fixture state before success");
assert.match(route, /form-action 'self'/, "domain fixture page CSP must keep forms same-origin");

const getIndex = route.indexOf("export async function GET");
const nextPostIndex = route.indexOf("export async function POST", getIndex);
const getBody = route.slice(getIndex, nextPostIndex);
assert.equal(getBody.includes("seedReferenceData("), false, "GET preflight must not seed reference data");
assert.equal(getBody.includes("seedDemoData("), false, "GET preflight must not seed demo data");
assert.match(getBody, /read only: true/, "GET preflight must clearly identify itself as read-only");

for (const email of [
  "client.lite@example.test",
  "client.pro@example.test",
  "client.individual@example.test",
  "lawyer.demo@example.test",
]) {
  assert.ok(helper.includes(email), `shared staging fixture helper must pin ${email}`);
}
for (const caseNumber of ["IBR-2026-000101", "IBR-2026-000102", "IBR-2026-000103"]) {
  assert.ok(helper.includes(caseNumber), `shared staging fixture helper must pin ${caseNumber}`);
}
assert.match(helper, /PLATFORM_ROLE_CODES/, "shared fixture helper must derive platform roles from the domain contract");
assert.match(helper, /AI_ASSISTANT/, "INDIVIDUAL reference fixture must preserve the AI assistant feature");
assert.match(helper, /upsert\(/, "shared fixture helper must use idempotent targeted upserts");
assert.equal(helper.includes("deleteMany"), false, "staging fixture seeding must never bulk-delete domain data");
assert.equal(helper.includes("delete("), false, "staging fixture seeding must not delete domain data");

assert.match(referenceSeed, /seedReferenceData/, "CLI reference seed must reuse the shared fixture helper");
assert.match(demoSeed, /seedDemoData/, "CLI demo seed must reuse the shared fixture helper");
assert.equal(
  referenceSeed.includes("client.individual@example.test"),
  false,
  "CLI reference wrapper must not duplicate demo fixture definitions",
);
assert.equal(
  demoSeed.includes("IBR-2026-000103"),
  false,
  "CLI demo wrapper must not duplicate demo case definitions",
);

console.log("STAGING_DOMAIN_FIXTURE_ROUTE_CONTRACT_PASS");
