import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

assert.match(route, /iburo127:staging:better-auth:1\.7\.3/);
assert.doesNotMatch(route, /"issuer" text not null/);
assert.doesNotMatch(route, /account_issuer_accountId_uidx/);

const reviewedSql = /const REVIEWED_SQL = `([\s\S]*?)`;/u.exec(route)?.[1] ?? "";
const expectedSqlSha256 = /const EXPECTED_SQL_SHA256 = "([a-f0-9]{64})";/u.exec(route)?.[1] ?? "";
assert.ok(reviewedSql, "staging Better Auth route must embed reviewed SQL");
assert.ok(expectedSqlSha256, "staging Better Auth route must pin reviewed SQL SHA-256");
assert.equal(
  createHash("sha256").update(reviewedSql).digest("hex"),
  expectedSqlSha256,
  "embedded Better Auth SQL must match its reviewed SHA-256 fingerprint",
);

console.log("STAGING_BETTER_AUTH_MIGRATION_ROUTE_CONTRACT_PASS");
