"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDemoIdentity } from "@/components/platform/DemoIdentityProvider";

export function ManagerRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { identity, isHydrated } = useDemoIdentity();
  useEffect(() => {
    if (isHydrated && identity.role !== "MANAGER") router.replace(identity.role === "LAWYER" ? "/app/lawyer" : "/app/client");
  }, [identity.role, isHydrated, router]);
  if (!isHydrated) return null;
  return identity.role === "MANAGER" ? children : null;
}
