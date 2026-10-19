import {
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const VERCEL_STAGING_AUTH_ORIGIN =
  "https://iburo127online-app-git-audit-pr-6caf2a-misterio712rino-projects.vercel.app";

type EnvironmentLike = Readonly<Record<string, string | undefined>>;

export function getBetterAuthTrustedOrigins(
  env: EnvironmentLike,
  baseUrl: string,
): string[] {
  const origins = [baseUrl];

  if (
    env.VERCEL_ENV?.trim() === "preview" &&
    isVercelPreviewBackendAllowed(env)
  ) {
    origins.push(VERCEL_STAGING_AUTH_ORIGIN);
  }

  return [...new Set(origins)];
}
