export const PLATFORM_MUTATION_ORIGIN_REJECTED = "PLATFORM_MUTATION_ORIGIN_REJECTED";
export const PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED = "PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const STAGING_NODE_USER_AGENT = "node";

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

function isRepositoryNodeVerifier(request: Pick<Request, "headers">): boolean {
  const origin = request.headers.get("origin")?.trim();
  const fetchSite = request.headers.get("sec-fetch-site")?.trim();
  const userAgent = request.headers.get("user-agent")?.trim().toLowerCase();
  return !origin && !fetchSite && userAgent === STAGING_NODE_USER_AGENT;
}

/**
 * Browser-authenticated platform mutations must originate from the exact
 * application origin. This is an additional CSRF boundary on top of cookie
 * SameSite policy and application authorization.
 *
 * The repository's Node 24 staging verifiers are the only origin-less client
 * class accepted: built-in Node fetch identifies itself with the exact
 * User-Agent "node" and sends no Fetch Metadata. Browser JavaScript cannot set
 * User-Agent, so browser mutations still require exact Origin and, when
 * present, Sec-Fetch-Site= same-origin.
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

  if (isRepositoryNodeVerifier(request)) return { allowed: true };

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
