"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDemoIdentity } from "@/components/platform/DemoIdentityProvider";
import { canAccessRole, getRoleRedirect } from "@/lib/platform/access-policy";

export function LawyerRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { identity, isHydrated } = useDemoIdentity();

  useEffect(() => {
    if (!isHydrated) return;
    const redirectTo = getRoleRedirect(identity.role, "LAWYER");
    if (redirectTo) router.replace(redirectTo);
  }, [identity.role, isHydrated, router]);

  if (!isHydrated) return null;
  return canAccessRole(identity.role, "LAWYER") ? children : null;
}
