import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const stagingRoot = resolve("app/%5Fiburo");
const expectedRoutes = [
  "staging-application-e2e-fixtures",
  "staging-auth-config",
  "staging-auth-fixtures",
  "staging-better-auth-migrate",
  "staging-better-auth-verify",
  "staging-db-baseline",
  "staging-domain-fixtures",
  "staging-external-readiness",
  "staging-identity",
  "staging-storage-verify",
] as const;

const routeDirectories = (await readdir(stagingRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

assert.deepEqual(
  routeDirectories,
  [...expectedRoutes].sort(),
  "staging internal route inventory must remain explicit so every new /_iburo endpoint receives an audited exact-Preview boundary",
);

for (const routeName of expectedRoutes) {
  const source = await readFile(resolve(stagingRoot, routeName, "route.ts"), "utf8");

  assert.match(source, /export const dynamic = "force-dynamic";/, `${routeName} must stay dynamic`);
  assert.match(
    source,
    /Cache-Control": "private, no-store, max-age=0"/,
    `${routeName} responses must remain private and no-store`,
  );
  assert.match(
    source,
    /function isExactStagingPreview\(env: NodeJS\.ProcessEnv\)/,
    `${routeName} must define an exact staging Preview boundary`,
  );
  assert.match(source, /env\.VERCEL_ENV\?\.trim\(\) === "preview"/, `${routeName} must require Vercel Preview`);
  assert.match(
    source,
    /env\.VERCEL_GIT_COMMIT_REF\?\.trim\(\) === VERCEL_STAGING_BRANCH/,
    `${routeName} must require the audited staging branch`,
  );
  assert.match(
    source,
    /env\.IB_RUNTIME_TARGET\?\.trim\(\) === "staging"/,
    `${routeName} must require the staging runtime target`,
  );
  assert.match(source, /VERCEL_GIT_COMMIT_SHA/, `${routeName} must bind to a Vercel commit SHA`);
  assert.match(source, /\^\[a-f0-9\]\{40\}\$/i, `${routeName} must validate an exact 40-character Git SHA`);
  assert.match(
    source,
    /isVercelPreviewBackendAllowed\(env\)/,
    `${routeName} must require the configured Preview backend boundary`,
  );

  const handlerPattern = /export async function (GET|POST|PUT|PATCH|DELETE)\([^)]*\)\s*\{/g;
  const handlers = [...source.matchAll(handlerPattern)];
  assert.ok(handlers.length > 0, `${routeName} must expose at least one audited HTTP handler`);

  for (let index = 0; index < handlers.length; index += 1) {
    const match = handlers[index]!;
    const start = match.index ?? 0;
    const end = handlers[index + 1]?.index ?? source.length;
    const handler = source.slice(start, end);
    const method = match[1];

    assert.match(
      handler,
      /const env = process\.env;[\s\S]{0,500}?isExactStagingPreview\(env\)/,
      `${routeName} ${method} must enforce the exact staging Preview boundary before normal work`,
    );
    assert.match(
      handler.slice(0, 900),
      /isExactStagingPreview\(env\)[\s\S]{0,700}?(?:status:\s*404|fail\([^\n]*404\)|unavailable\(\))/,
      `${routeName} ${method} must fail closed with 404 when the exact staging Preview boundary is not satisfied`,
    );
  }
}

console.log("STAGING_INTERNAL_ROUTE_BOUNDARY_CONTRACT_PASS");
