import assert from "node:assert/strict";
import {
  VERCEL_STAGING_BRANCH,
  VERCEL_STAGING_REPOSITORY_ID,
  VERCEL_STAGING_REPOSITORY_NAME,
  VERCEL_STAGING_REPOSITORY_OWNER,
  isVercelPreviewBackendAllowed,
} from "../server/config/vercel-preview-boundary";

const currentSha = "dba8de286927a9dec6fef1f0b5fb66e321f24c7c";
const base = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_PROVIDER: "github",
  VERCEL_GIT_REPO_OWNER: VERCEL_STAGING_REPOSITORY_OWNER,
  VERCEL_GIT_REPO_SLUG: VERCEL_STAGING_REPOSITORY_NAME,
  VERCEL_GIT_REPO_ID: VERCEL_STAGING_REPOSITORY_ID,
  VERCEL_GIT_COMMIT_SHA: currentSha,
  VERCEL_GIT_COMMIT_REF: VERCEL_STAGING_BRANCH,
  IB_RUNTIME_TARGET: "staging",
};

assert.equal(isVercelPreviewBackendAllowed(base), true);

assert.equal(
  isVercelPreviewBackendAllowed({
    ...base,
    VERCEL_GIT_REPO_OWNER: "attacker",
  }),
  false,
  "foreign repository owner must never enable the staging Preview backend",
);

assert.equal(
  isVercelPreviewBackendAllowed({
    ...base,
    VERCEL_GIT_REPO_SLUG: "other-repository",
  }),
  false,
  "foreign repository slug must never enable the staging Preview backend",
);

assert.equal(
  isVercelPreviewBackendAllowed({
    ...base,
    VERCEL_GIT_REPO_ID: "1",
  }),
  false,
  "foreign repository id must never enable the staging Preview backend",
);

assert.equal(
  isVercelPreviewBackendAllowed({
    ...base,
    VERCEL_GIT_PROVIDER: "gitlab",
  }),
  false,
  "non-GitHub deployments must never enable the staging Preview backend",
);

assert.equal(
  isVercelPreviewBackendAllowed({
    ...base,
    VERCEL_GIT_COMMIT_REF: "main",
  }),
  false,
  "production branch must never enable the staging Preview backend",
);

assert.equal(
  isVercelPreviewBackendAllowed({
    ...base,
    VERCEL_GIT_COMMIT_SHA: "not-a-sha",
  }),
  false,
  "invalid commit SHA must never enable the staging Preview backend",
);

console.log("VERCEL_PREVIEW_BOUNDARY_TEST_PASS");
