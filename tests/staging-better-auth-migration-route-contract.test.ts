import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const route = await readFile(
  resolve("app/%5Fiburo/staging-better-auth-migrate/route.ts"),
  "utf8",
);

const originIndex = route.indexOf('request.headers.get("origin")');
const fetchSiteIndex = route.indexOf('request.headers.get("sec-fetch-site")');
const exactOriginIndex = route.indexOf("origin === requestUrl.origin");
const sameOriginFetchIndex = route.indexOf('secFetchSite === "same-origin"');
const confirmationIndex = route.indexOf('formData.get("confirm")');
const poolIndex = route.indexOf("new Pool(", route.indexOf("export async function POST"));

assert.ok(originIndex >= 0, "staging Better Auth migration POST must inspect Origin");
assert.ok(fetchSiteIndex >= 0, "staging Better Auth migration POST must inspect Sec-Fetch-Site");
assert.ok(exactOriginIndex >= 0, "staging Better Auth migration POST must retain exact Origin matching");
assert.ok(
  sameOriginFetchIndex >= 0,
  "staging Better Auth migration POST may only use same-origin Fetch Metadata as the browser fallback",
);
assert.equal(
  route.includes('secFetchSite === "same-site"'),
  false,
  "same-site requests must not satisfy the staging migration CSRF guard",
);
assert.equal(
  route.includes('secFetchSite === "cross-site"'),
  false,
  "cross-site requests must not satisfy the staging migration CSRF guard",
);
assert.ok(confirmationIndex > sameOriginFetchIndex, "per-SHA confirmation must remain after the origin guard");
assert.ok(poolIndex > confirmationIndex, "database access must remain unreachable before origin and confirmation guards pass");
assert.match(route, /form-action 'self'/, "migration page CSP must keep forms same-origin");

console.log("STAGING_BETTER_AUTH_MIGRATION_ROUTE_CONTRACT_PASS");
