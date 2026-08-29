import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, ClipboardList, House, KeyRound, ShieldCheck } from "lucide-react";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";

export function PortalFrame({
  children,
  sectionLabel,
  accessLabel = "Сессия подтверждена",
  showStaffTasks = false,
}: {
  children: ReactNode;
  sectionLabel: string;
  accessLabel?: string;
  showStaffTasks?: boolean;
}) {
  return (
    <div className="platform-shell mx-auto min-h-screen w-full max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/portal" className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7B2330]/15">
            <IBuroBrand dot className="font-[var(--font-iburo-display)] text-4xl font-semibold tracking-tight" />
          </Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            {sectionLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <ShieldCheck className="size-4" aria-hidden="true" />
            {accessLabel}
          </span>
          <SignOutButton />
        </div>
      </header>

      <nav aria-label="Основная навигация защищённого кабинета" className="flex flex-wrap gap-2 border-b border-slate-200 py-4">
        <Link href="/portal" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900">
          <House className="size-4" aria-hidden="true" />
          Кабинет
        </Link>
        <Link href="/portal/notifications" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900">
          <Bell className="size-4" aria-hidden="true" />
          Уведомления
        </Link>
        <Link href="/portal/security" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900">
          <KeyRound className="size-4" aria-hidden="true" />
          Безопасность
        </Link>
        {showStaffTasks ? (
          <Link href="/portal/tasks" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900">
            <ClipboardList className="size-4" aria-hidden="true" />
            Задачи
          </Link>
        ) : null}
      </nav>

      {children}
    </div>
  );
}
