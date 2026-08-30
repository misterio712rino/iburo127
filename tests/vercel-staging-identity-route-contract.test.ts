import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const routablePath = resolve("app/%5Fiburo/staging-identity/route.ts");
const privateFolderPath = resolve("app/_iburo/staging-identity/route.ts");

const routeSource = await readFile(routablePath, "utf8");
assert.match(routeSource, /service:\s*"iburo127"/);
assert.match(routeSource, /environment:\s*runtimeEnvironment\(env\)/);
assert.match(routeSource, /commitSha:\s*commitSha\(env\)/);
assert.match(routeSource, /backendEnabled:\s*isVercelPreviewBackendAllowed\(env\)/);

await assert.rejects(
  access(privateFolderPath),
  undefined,
  "staging identity route must not live under a Next.js private _-prefixed folder",
);

console.log("VERCEL_STAGING_IDENTITY_ROUTE_CONTRACT_TEST_PASS");
