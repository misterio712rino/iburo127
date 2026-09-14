"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_CLIENT_IDENTITY, getDemoIdentity } from "@/lib/platform/demo";
import { getPlatformTheme } from "@/lib/platform/themes";
import type { DemoIdentity } from "@/lib/platform/types";

const STORAGE_KEY = "iburo.demo.identity.v1";

type DemoIdentityContextValue = { identity: DemoIdentity; isHydrated: boolean; selectIdentity: (identity: DemoIdentity) => void };
const DemoIdentityContext = createContext<DemoIdentityContextValue | null>(null);

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("iburo-demo-identity", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("iburo-demo-identity", callback); };
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CLIENT_IDENTITY.id;
}

function subscribeHydration() { return () => undefined; }

export function DemoIdentityProvider({ children }: { children: ReactNode }) {
  const identityId = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_CLIENT_IDENTITY.id);
  const isHydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const identity = getDemoIdentity(identityId) ?? DEFAULT_CLIENT_IDENTITY;

  useEffect(() => {
    document.documentElement.dataset.platformTheme = getPlatformTheme(identity);
    return () => { delete document.documentElement.dataset.platformTheme; };
  }, [identity]);

  function selectIdentity(nextIdentity: DemoIdentity) {
    window.localStorage.setItem(STORAGE_KEY, nextIdentity.id);
    window.dispatchEvent(new Event("iburo-demo-identity"));
  }

  return <DemoIdentityContext.Provider value={{ identity, isHydrated, selectIdentity }}>{children}</DemoIdentityContext.Provider>;
}

export function useDemoIdentity() {
  const context = useContext(DemoIdentityContext);
  if (!context) throw new Error("useDemoIdentity must be used inside DemoIdentityProvider");
  return context;
}
