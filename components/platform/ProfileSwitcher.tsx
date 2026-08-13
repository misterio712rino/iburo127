"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { DEMO_IDENTITIES } from "@/lib/platform/demo";
import { PLAN_LABEL } from "@/lib/platform/themes";
import { useDemoIdentity } from "./DemoIdentityProvider";
import { ProfileAvatar } from "./PlatformPrimitives";

export function ProfileSwitcher() {
  const router = useRouter();
  const { identity, selectIdentity } = useDemoIdentity();
  return <label className="relative flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2">
    <ProfileAvatar initials={identity.initials} />
    <span className="hidden min-w-0 sm:block"><span className="block truncate text-sm font-semibold">{identity.displayName}</span><span className="block text-xs text-muted-foreground">{identity.role === "LAWYER" ? "Юрист" : `Тариф ${PLAN_LABEL[identity.plan!]}`}</span></span>
    <ChevronDown aria-hidden="true" />
    <span className="sr-only">Сменить демонстрационный профиль</span>
    <select className="absolute inset-0 cursor-pointer opacity-0" value={identity.id} aria-label="Сменить демонстрационный профиль" onChange={(event) => { const next = DEMO_IDENTITIES.find((item) => item.id === event.target.value); if (!next) return; selectIdentity(next); router.push(next.role === "LAWYER" ? "/app/lawyer" : "/app/client"); }}>
      {DEMO_IDENTITIES.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
    </select>
  </label>;
}
