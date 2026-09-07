export const VERCEL_PREVIEW_BOUNDARY_ERROR = "VERCEL_PREVIEW_BOUNDARY_ERROR";

export const VERCEL_STAGING_BRANCH = "audit/production-readiness";
export const VERCEL_STAGING_CONFIRMATION = `STAGING:${VERCEL_STAGING_BRANCH}`;

const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

function isPreviewBackendConfirmationAllowed(value: string | undefined, commitSha: string) {
  const confirmation = value?.trim().toLowerCase();
  const branchConfirmation = VERCEL_STAGING_CONFIRMATION.toLowerCase();
  if (confirmation === branchConfirmation) return true;

  const legacyPrefix = `${branchConfirmation}:`;
  if (!confirmation?.startsWith(legacyPrefix)) return false;

  const legacySha = confirmation.slice(legacyPrefix.length);
  return EXACT_GIT_SHA_PATTERN.test(legacySha) && legacySha !== commitSha;
}

export function isVercelPreviewBackendAllowed(env: EnvironmentLike = process.env) {
  const vercelEnvironment = env.VERCEL_ENV?.trim();
  if (vercelEnvironment !== "preview") return true;

  const commitSha = env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase();
  if (!commitSha || !EXACT_GIT_SHA_PATTERN.test(commitSha)) return false;

  return (
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    isPreviewBackendConfirmationAllowed(env.IB_VERCEL_PREVIEW_BACKEND_CONFIRM, commitSha)
  );
}

export function assertVercelPreviewBackendAllowed(env: EnvironmentLike = process.env) {
  if (isVercelPreviewBackendAllowed(env)) return;
  throw new Error(VERCEL_PREVIEW_BOUNDARY_ERROR);
}
