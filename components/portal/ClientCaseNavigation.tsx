"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  ClipboardCheck,
  FileText,
  House,
  Sparkles,
  UserRound,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "home", label: "Главная", segment: "", icon: House },
  { key: "practicum", label: "Практикум", segment: "/practicum", icon: BookOpen },
  { key: "questionnaire", label: "Анкета", segment: "/questionnaire", icon: ClipboardCheck },
  { key: "documents", label: "Документы", segment: "/documents", icon: FileText },
  { key: "progress", label: "Мой прогресс", segment: "/progress", icon: ChartNoAxesColumnIncreasing },
  { key: "ai", label: "AI-помощник", segment: "/ai", icon: Sparkles },
  { key: "notifications", label: "Уведомления", segment: null, icon: Bell },
  { key: "profile", label: "Профиль", segment: null, icon: UserRound },
] as const;

function isCurrent(pathname: string, href: string, base: string) {
  const path = href.split("?", 1)[0];
  if (path === base) return pathname === base;
  if (path === "/portal/profile") return pathname === path || pathname === "/portal/security";
  if (path === "/portal/notifications") return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function resolveHref(key: (typeof NAV_ITEMS)[number]["key"], segment: (typeof NAV_ITEMS)[number]["segment"], caseId: string, base: string) {
  if (key === "profile") return `/portal/profile?caseId=${caseId}`;
  if (key === "notifications") return `/portal/notifications?caseId=${caseId}`;
  return `${base}${segment ?? ""}`;
}

export function ClientCaseNavigation({ caseId, mobile = false }: { caseId: string; mobile?: boolean }) {
  const pathname = usePathname();
  const base = `/portal/cases/${caseId}`;

  if (mobile) {
    return (
      <nav className="flex gap-2 overflow-x-auto px-4 py-2" aria-label="Мобильная навигация клиентского кабинета">
        {NAV_ITEMS.map(({ key, label, segment }) => {
          const href = resolveHref(key, segment, caseId, base);
          const active = isCurrent(pathname, href, base);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 py-2 text-xs font-semibold transition ${
                active
                  ? "border-[#b9202b]/20 bg-[#b9202b]/[0.08] text-[#9f2029]"
                  : "border-white/70 bg-white text-[#55585d] shadow-sm hover:border-black/10 hover:text-[#1d222b]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="mt-10 flex flex-col gap-1" aria-label="Навигация клиентского кабинета">
      {NAV_ITEMS.map(({ key, label, segment, icon: Icon }) => {
        const href = resolveHref(key, segment, caseId, base);
        const active = isCurrent(pathname, href, base);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-2xl border px-3.5 text-sm font-semibold transition ${
              active
                ? "border-[#b9202b]/15 bg-white text-[#1d222b] shadow-[0_8px_28px_rgba(65,47,35,0.08)]"
                : "border-transparent text-[#56595f] hover:bg-white/80 hover:text-[#1d222b]"
            }`}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
