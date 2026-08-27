"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDemoIdentity } from "@/components/platform/DemoIdentityProvider";

export function LawyerRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { identity, isHydrated } = useDemoIdentity();
  useEffect(() => { if (isHydrated && identity.role !== "LAWYER") router.replace(identity.role === "MANAGER" ? "/app/manager" : "/app/client"); }, [identity.role, isHydrated, router]);
  if (!isHydrated) return null;
  return identity.role === "LAWYER" ? children : null;
}
