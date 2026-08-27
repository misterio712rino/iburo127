"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDemoIdentity } from "@/components/platform/DemoIdentityProvider";

export function ClientRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { identity, isHydrated } = useDemoIdentity();
  useEffect(() => { if (isHydrated && identity.role !== "CLIENT") router.replace(identity.role === "MANAGER" ? "/app/manager" : "/app/lawyer"); }, [identity.role, isHydrated, router]);
  if (!isHydrated) return null;
  return identity.role === "CLIENT" ? children : null;
}
