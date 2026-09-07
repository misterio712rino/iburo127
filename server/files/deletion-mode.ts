import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const FILE_DELETION_MODE_INVALID = "FILE_DELETION_MODE_INVALID";

export type StoredFileDeletionMode = "legacy" | "durable";
type StoredFileDeletionModeEnv = Record<string, string | undefined>;

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;

function isExactAuditStagingPreview(env: StoredFileDeletionModeEnv) {
  const commitSha = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return (
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    Boolean(commitSha && EXACT_GIT_SHA_PATTERN.test(commitSha)) &&
    isVercelPreviewBackendAllowed(env)
  );
}

export function readStoredFileDeletionMode(
  env: StoredFileDeletionModeEnv = process.env,
): StoredFileDeletionMode {
  const raw = env.IB_FILE_DELETION_MODE?.trim();
  if (raw === "legacy") return "legacy";
  if (raw === "durable") return "durable";
  if (raw) throw new Error(FILE_DELETION_MODE_INVALID);

  // Audit Preview is the isolated cutover target. This lets staging prove the
  // durable path even when the provider UI cannot write Preview env variables,
  // while every non-Preview/production runtime remains legacy by default.
  if (isExactAuditStagingPreview(env)) return "durable";
  return "legacy";
}
