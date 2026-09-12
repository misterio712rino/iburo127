export const IB_STAGING_CONTROL_HEADER = "x-iburo-staging-control";

const MIN_AUTOMATION_SECRET_LENGTH = 16;
const MAX_AUTOMATION_SECRET_LENGTH = 512;
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const EXACT_STAGING_BRANCH = "audit/production-readiness";
const VERCEL_DEPLOYMENT_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.vercel\.app$/;
const AUTH_PROBE_TIMEOUT_MS = 5_000;
const IDENTITY_PATH = "/_iburo/staging-identity";

type EnvironmentLike = Readonly<Record<string, string | undefined>>;
type FetchLike = typeof fetch;

function safeAutomationSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (
    value.length < MIN_AUTOMATION_SECRET_LENGTH ||
    value.length > MAX_AUTOMATION_SECRET_LENGTH ||
    value !== value.trim() ||
    /[\r\n\0]/.test(value)
  ) {
    return null;
  }
  return value;
}

function exactDeploymentOrigin(env: EnvironmentLike): string | null {
  if (
    env.VERCEL_ENV?.trim() !== "preview" ||
    env.VERCEL_GIT_COMMIT_REF?.trim() !== EXACT_STAGING_BRANCH ||
    env.IB_RUNTIME_TARGET?.trim() !== "staging"
  ) {
    return null;
  }

  const commitSha = env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase();
  if (!commitSha || !EXACT_GIT_SHA_PATTERN.test(commitSha)) return null;

  const hostname = env.VERCEL_URL?.trim().toLowerCase().replace(/\.+$/, "");
  if (!hostname || !VERCEL_DEPLOYMENT_HOST_PATTERN.test(hostname)) return null;

  return `https://${hostname}`;
}

export async function isAuthorizedVercelAutomationRequest(
  request: Pick<Request, "headers">,
  env: EnvironmentLike = process.env,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  const provided = safeAutomationSecret(request.headers.get(IB_STAGING_CONTROL_HEADER));
  const deploymentOrigin = exactDeploymentOrigin(env);
  const expectedCommitSha = env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase();
  if (!provided || !deploymentOrigin || !expectedCommitSha) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_PROBE_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${deploymentOrigin}${IDENTITY_PATH}`, {
      method: "GET",
      headers: {
        "x-vercel-protection-bypass": provided,
      },
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status !== 200) return false;

    const body = (await response.json()) as Record<string, unknown>;
    return (
      body.service === "iburo127" &&
      body.environment === "preview" &&
      body.branch === EXACT_STAGING_BRANCH &&
      body.commitSha === expectedCommitSha &&
      body.runtimeTarget === "staging" &&
      body.backendEnabled === true
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
