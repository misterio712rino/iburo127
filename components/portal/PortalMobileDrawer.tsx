"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, ShieldCheck, UserRound, X } from "lucide-react";

import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import { PortalNavigation } from "@/components/portal/PortalNavigation";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "iБ"
  );
}

export function PortalMobileDrawer({
  displayName = "Профиль",
  accessLabel = "Сессия подтверждена",
  showStaffTasks = false,
  showProspectLeads = false,
}: {
  displayName?: string;
  accessLabel?: string;
  showStaffTasks?: boolean;
  showProspectLeads?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex min-h-[68px] w-full items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Открыть меню"
          aria-expanded={open}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-[#3b4248] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f1720]/10"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>

        <Link
          href="/portal/profile"
          className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full border border-[#dfe3e6] bg-white py-1.5 pl-1.5 pr-3 text-[#3b4248] shadow-sm transition hover:border-[#cfd4d8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f1720]/10"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#8f1720] text-[10px] font-bold text-white">
            {displayName === "Профиль" ? <UserRound className="size-4" aria-hidden="true" /> : initials(displayName)}
          </span>
          <span className="max-w-[180px] truncate text-xs font-semibold">{displayName}</span>
        </Link>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[120] lg:hidden" role="dialog" aria-modal="true" aria-label="Меню кабинета">
          <button
            type="button"
            aria-label="Закрыть меню"
            className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-[min(86vw,330px)] flex-col bg-[#202b33] px-5 py-5 text-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <Link href="/portal" onClick={() => setOpen(false)} className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/10">
                <IBuroBrand dot className="font-[var(--font-iburo-display)] text-[30px] font-semibold tracking-[-0.045em]" />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть меню"
                className="grid size-11 place-items-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/10"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 overflow-y-auto pb-4" onClick={() => setOpen(false)}>
              <PortalNavigation
                variant="sidebar"
                showStaffTasks={showStaffTasks}
                showProspectLeads={showProspectLeads}
              />
            </div>

            <div className="mt-auto border-t border-white/10 pt-5">
              <div className="mb-4 flex items-center gap-2.5 text-xs font-semibold text-white/72">
                <ShieldCheck className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <span>{accessLabel}</span>
              </div>
              <SignOutButton />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
