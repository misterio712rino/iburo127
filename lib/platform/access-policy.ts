import type { DemoRole } from "@/lib/platform/types";

export type PlatformRole = DemoRole;

const ROLE_HOME: Record<PlatformRole, string> = {
  CLIENT: "/app/client",
  LAWYER: "/app/lawyer",
  MANAGER: "/app/manager",
};

export function getRoleHome(role: PlatformRole): string {
  return ROLE_HOME[role];
}

export function canAccessRole(actorRole: PlatformRole, requiredRole: PlatformRole): boolean {
  return actorRole === requiredRole;
}

export function getRoleRedirect(actorRole: PlatformRole, requiredRole: PlatformRole): string | null {
  return canAccessRole(actorRole, requiredRole) ? null : getRoleHome(actorRole);
}
