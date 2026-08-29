export const VERCEL_PREVIEW_BOUNDARY_ERROR = "VERCEL_PREVIEW_BOUNDARY_ERROR";

export const VERCEL_STAGING_BRANCH = "audit/production-readiness";
export const VERCEL_STAGING_CONFIRMATION = `STAGING:${VERCEL_STAGING_BRANCH}`;

export function isVercelPreviewBackendAllowed(env: NodeJS.ProcessEnv = process.env) {
  const vercelEnvironment = env.VERCEL_ENV?.trim();
  if (vercelEnvironment !== "preview") return true;

  return (
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    env.IB_VERCEL_PREVIEW_BACKEND_CONFIRM?.trim() === VERCEL_STAGING_CONFIRMATION
  );
}

export function assertVercelPreviewBackendAllowed(env: NodeJS.ProcessEnv = process.env) {
  if (isVercelPreviewBackendAllowed(env)) return;
  throw new Error(VERCEL_PREVIEW_BOUNDARY_ERROR);
}
