const BETTER_AUTH_API_PREFIX = "/api/auth/";

export function getManualTrailingSlashRedirectPath(pathname: string): string | null {
  if (pathname === "/" || !pathname.endsWith("/")) return null;
  if (pathname.startsWith(BETTER_AUTH_API_PREFIX)) return null;

  const canonicalPathname = pathname.replace(/\/+$/, "");
  return canonicalPathname || "/";
}
