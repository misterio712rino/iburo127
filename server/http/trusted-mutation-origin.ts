export const PLATFORM_MUTATION_ORIGIN_REJECTED = "PLATFORM_MUTATION_ORIGIN_REJECTED";
export const PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED = "PLATFORM_MUTATION_ORIGIN_NOT_CONFIGURED";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

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
    parsed.origin === raw &&
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

/**
 * Browser-authenticated platform mutations must originate from the exact
 * application origin. This is an additional CSRF boundary on top of cookie
 * SameSite policy and application authorization.
 *
 * Non-browser staging verifiers may omit Fetch Metadata, but they must still
 * send the exact Origin header. Browser requests that do provide
 * Sec-Fetch-Site are accepted only when the browser reports same-origin.
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
