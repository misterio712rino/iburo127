export const DEMO_PORTAL_MODE_ENABLED = "enabled";

export function isDemoPortalEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.IB_DEMO_PORTAL_MODE?.trim() === DEMO_PORTAL_MODE_ENABLED;
}
