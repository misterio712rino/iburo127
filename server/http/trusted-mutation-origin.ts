import {
  VERCEL_STAGING_BRANCH,
  VERCEL_STAGING_CONFIRMATION,
} from "@/server/config/vercel-preview-boundary";

export const PLATFORM_MUTATION_ORIGIN_REJECTED = "PLATFORM_MUTATION_ORIGIN_REJECTED";
export const PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED = "PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const STAGING_NODE_USER_AGENT = "node";
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;

export type PlatformMutationOriginDecision =
  | { allowed: true }
  | {
      allowed: false;
      status: 403 | 503;
      code:
        | typeof PLATFORM_MUTATION_ORIGIN_REJECTED
        | typeof PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED;
    };

function parseConfiguredOrigin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const loopback =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "[::1]";
  const secureProtocol = parsed.protocol === "https:" || (loopback && parsed.protocol === "http:");
  const originOnly =
    (parsed.pathname === "/" || parsed.pathname === "") &&
    !parsed.search &&
    !parsed.hash &&
    !parsed.username &&
    !parsed.password;

  return secureProtocol && originOnly ? parsed.origin : null;
}

function parseRequestOrigin(value: string | null): string | null {
  const raw = value?.trim();
  if (!raw || raw === "null") return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (
    parsed.origin !== raw ||
    (parsed.pathname !== "/" && parsed.pathname !== "") ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    return null;
  }

  return parsed.origin;
}

function isConfirmedStagingPreview(env: Record<string, string | undefined>): boolean {
  const commitSha = env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase() ?? "";
  return (
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    EXACT_GIT_SHA_PATTERN.test(commitSha) &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    env.IB_VERCEL_PREVIEW_BACKEND_CONFIRM?.trim().toLowerCase() ===
      VERCEL_STAGING_CONFIRMATION.toLowerCase()
  );
}

function isRepositoryNodeVerifier(
  request: Pick<Request, "headers">,
  env: Record<string, string | undefined>,
): boolean {
  const origin = request.headers.get("origin")?.trim();
  const fetchSite = request.headers.get("sec-fetch-site")?.trim();
  const userAgent = request.headers.get("user-agent")?.trim().toLowerCase();
  return (
    !origin &&
    !fetchSite &&
    userAgent === STAGING_NODE_USER_AGENT &&
    isConfirmedStagingPreview(env)
  );
}

/**
 * Browser-authenticated platform mutations must originate from the exact
 * application origin. This is an additional CSRF boundary on top of cookie
 * SameSite policy and application authorization.
 *
 * Origin-less Node requests are accepted only for the repository's staging
 * verifiers running against the explicitly confirmed Vercel staging Preview.
 * A spoofed User-Agent alone is never sufficient outside that environment.
 */
export function evaluatePlatformMutationOrigin(
  request: Pick<Request, "method" | "headers">,
  env: Record<string, string | undefined> = process.env,
): PlatformMutationOriginDecision {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return { allowed: true };

  const expectedOrigin = parseConfiguredOrigin(env.BETTER_AUTH_URL);
  if (!expectedOrigin) {
    return {
      allowed: false,
      status: 503,
      code: PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED,
    };
  }

  if (isRepositoryNodeVerifier(request, env)) return { allowed: true };

  const requestOrigin = parseRequestOrigin(request.headers.get("origin"));
  if (requestOrigin !== expectedOrigin) {
    return {
      allowed: false,
      status: 403,
      code: PLATFORM_MUTATION_ORIGIN_REJECTED,
    };
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") {
    return {
      allowed: false,
      status: 403,
      code: PLATFORM_MUTATION_ORIGIN_REJECTED,
    };
  }

  return { allowed: true };
}
