import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const routablePath = resolve("app/%5Fiburo/staging-identity/route.ts");
const privateFolderPath = resolve("app/_iburo/staging-identity/route.ts");

const routeSource = await readFile(routablePath, "utf8");
assert.match(routeSource, /function isExactStagingPreview\(env: NodeJS\.ProcessEnv\)/);
assert.match(routeSource, /env\.VERCEL_ENV\?\.trim\(\) === "preview"/);
assert.match(routeSource, /env\.VERCEL_GIT_COMMIT_REF\?\.trim\(\) === VERCEL_STAGING_BRANCH/);
assert.match(routeSource, /env\.IB_RUNTIME_TARGET\?\.trim\(\) === "staging"/);
assert.match(routeSource, /commitSha\(env\) !== null/);
assert.match(routeSource, /isVercelPreviewBackendAllowed\(env\)/);
assert.match(
  routeSource,
  /if \(!isExactStagingPreview\(env\)\) \{[\s\S]*?status: 404/,
  "staging identity route must fail closed outside the exact staging Preview",
);
assert.match(routeSource, /service:\s*"iburo127"/);
assert.match(routeSource, /environment:\s*runtimeEnvironment\(env\)/);
assert.match(routeSource, /branch:\s*VERCEL_STAGING_BRANCH/);
assert.match(routeSource, /commitSha:\s*commitSha\(env\)/);
assert.match(routeSource, /runtimeTarget:\s*runtimeTarget\(env\)/);
assert.match(routeSource, /backendEnabled:\s*true/);
assert.match(routeSource, /Cache-Control": "private, no-store, max-age=0"/);

await assert.rejects(
  access(privateFolderPath),
  /ENOENT/,
  "staging identity route must not live under a Next.js private _-prefixed folder",
);

console.log("VERCEL_STAGING_IDENTITY_ROUTE_CONTRACT_TEST_PASS");
