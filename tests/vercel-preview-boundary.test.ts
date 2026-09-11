import assert from "node:assert/strict";
import {
  VERCEL_STAGING_BRANCH,
  VERCEL_STAGING_CONFIRMATION,
  isVercelPreviewBackendAllowed,
} from "../server/config/vercel-preview-boundary";

const currentSha = "ae8e0a34af1ae91c8ea18003b2851be085d4bf12";
const staleSha = "571b1422d0a5ab33b49db938db0151db6417e781";
const base = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_SHA: currentSha,
  VERCEL_GIT_COMMIT_REF: VERCEL_STAGING_BRANCH,
  IB_RUNTIME_TARGET: "staging",
};

assert.equal(
  isVercelPreviewBackendAllowed({
    ...base,
    IB_VERCEL_PREVIEW_BACKEND_CONFIRM: VERCEL_STAGING_CONFIRMATION,
  }),
  true,
);

assert.equal(
  isVercelPreviewBackendAllowed({
    ...base,
    IB_VERCEL_PREVIEW_BACKEND_CONFIRM: VERCEL_STAGING_CONFIRMATION + ":" + staleSha,
  }),
  false,
  "stale SHA confirmation must never allow the current Preview backend",
);

assert.equal(
  isVercelPreviewBackendAllowed({
    ...base,
    IB_VERCEL_PREVIEW_BACKEND_CONFIRM: VERCEL_STAGING_CONFIRMATION + ":" + currentSha,
  }),
  false,
  "legacy SHA-qualified confirmation must not bypass the exact branch confirmation",
);

assert.equal(
  isVercelPreviewBackendAllowed({
    ...base,
    IB_VERCEL_PREVIEW_BACKEND_CONFIRM: "STAGING:wrong-branch",
  }),
  false,
);

console.log("VERCEL_PREVIEW_BOUNDARY_TEST_PASS");
