import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import { PortalMobileDrawer } from "@/components/portal/PortalMobileDrawer";
import { PortalMotionContent } from "@/components/portal/PortalMotionContent";
import { PortalMotionStyles } from "@/components/portal/PortalMotionStyles";
import { PortalNavigation } from "@/components/portal/PortalNavigation";

export function PortalFrame({
  children,
  sectionLabel,
  accessLabel = "Сессия подтверждена",
  showStaffTasks = false,
  showProspectLeads = false,
}: {
  children: ReactNode;
  sectionLabel: string;
  accessLabel?: string;
  showStaffTasks?: boolean;
  showProspectLeads?: boolean;
}) {
  return (
    <div className="portal-motion-shell min-h-screen bg-[#f3f5f6] text-[#202326] [&_button]:min-h-11 [&_a]:min-h-11">
      <PortalMotionStyles />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-white/[0.04] bg-[#202b33] px-6 py-7 text-white lg:flex">
        <Link
          href="/portal"
          className="inline-flex w-fit rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/10"
        >
          <IBuroBrand dot className="font-[var(--font-iburo-display)] text-[34px] font-semibold tracking-[-0.045em]" />
        </Link>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
          рабочее пространство
        </p>

        <div className="mt-10">
          <PortalNavigation
            variant="sidebar"
            showStaffTasks={showStaffTasks}
            showProspectLeads={showProspectLeads}
          />
        </div>

        <div className="mt-auto rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-white/82">
            <ShieldCheck className="size-[18px] shrink-0 text-emerald-300" aria-hidden="true" />
            <span>{accessLabel}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-white/42">
            Защищённая сессия iБюро
          </p>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[280px]">
        <header className="sticky top-0 z-30 border-b border-[#dfe3e6] bg-[#f3f5f6]/95 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[68px] w-full max-w-[1380px] items-center justify-between gap-4 px-4 sm:min-h-[76px] sm:px-8 lg:min-h-[84px] lg:px-12">
            <PortalMobileDrawer
              displayName="Профиль"
              accessLabel={accessLabel}
              showStaffTasks={showStaffTasks}
              showProspectLeads={showProspectLeads}
            />

            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-base font-semibold text-[#3b4248]">{sectionLabel}</p>
              <p className="mt-1 text-xs text-[#899198]">iБюро · защищённый кабинет</p>
            </div>

            <div className="hidden shrink-0 items-center gap-3 lg:flex">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-4 py-2.5 text-sm font-semibold text-emerald-800">
                <ShieldCheck className="size-[18px] shrink-0" aria-hidden="true" />
                {accessLabel}
              </span>
              <SignOutButton />
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1380px] px-5 sm:px-8 lg:px-12">
          <PortalMotionContent>{children}</PortalMotionContent>
        </div>
      </div>
    </div>
  );
}
