"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ClipboardList, House, KeyRound, UserRound, Users } from "lucide-react";

const BASE_CLASS = "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition";

export function PortalNavigation({ showStaffTasks = false, showProspectLeads = false }: { showStaffTasks?: boolean; showProspectLeads?: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/portal", label: "Кабинет", icon: House, visible: true },
    { href: "/portal/profile", label: "Профиль", icon: UserRound, visible: true },
    { href: "/portal/notifications", label: "Уведомления", icon: Bell, visible: true },
    { href: "/portal/security", label: "Безопасность", icon: KeyRound, visible: true },
    { href: "/portal/tasks", label: "Задачи", icon: ClipboardList, visible: showStaffTasks },
    { href: "/portal/leads", label: "Потенциальные клиенты", icon: Users, visible: showProspectLeads },
  ] as const;

  return (
    <nav
      aria-label="Основная навигация защищённого кабинета"
      className="-mx-5 flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain border-b border-slate-200 px-5 py-3 sm:mx-0 sm:flex-wrap sm:px-0 sm:py-4"
    >
      {items.filter((item) => item.visible).map(({ href, label, icon: Icon }) => {
        const active = href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`${BASE_CLASS} ${
              active
                ? "border-slate-200 bg-white text-slate-900 shadow-sm"
                : "border-transparent text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
