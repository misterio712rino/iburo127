import assert from "node:assert/strict";
import {
  getBetterAuthTrustedOrigins,
  VERCEL_STAGING_AUTH_ORIGIN,
} from "../server/auth/better-auth-trusted-origins";

const baseUrl = "https://iburo127.ru";
const auditPreviewEnv = {
  VERCEL_ENV: "preview",
  IB_RUNTIME_TARGET: "staging",
  VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
  VERCEL_GIT_COMMIT_REF: "audit/production-readiness",
  VERCEL_GIT_PROVIDER: "github",
  VERCEL_GIT_REPO_OWNER: "misterio712rino",
  VERCEL_GIT_REPO_SLUG: "iburo127",
  VERCEL_GIT_REPO_ID: "1303795826",
};

assert.deepEqual(getBetterAuthTrustedOrigins(auditPreviewEnv, baseUrl), [
  baseUrl,
  VERCEL_STAGING_AUTH_ORIGIN,
]);

assert.deepEqual(
  getBetterAuthTrustedOrigins(
    { ...auditPreviewEnv, VERCEL_GIT_COMMIT_REF: "feature/other-preview" },
    baseUrl,
  ),
  [baseUrl],
);

assert.deepEqual(
  getBetterAuthTrustedOrigins(
    { ...auditPreviewEnv, VERCEL_ENV: "production" },
    baseUrl,
  ),
  [baseUrl],
);

assert.deepEqual(
  getBetterAuthTrustedOrigins(
    { ...auditPreviewEnv, VERCEL_GIT_REPO_ID: "another-project" },
    baseUrl,
  ),
  [baseUrl],
);

console.log("BETTER_AUTH_TRUSTED_ORIGINS_TEST_PASS");
