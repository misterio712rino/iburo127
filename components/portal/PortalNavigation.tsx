"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  ClipboardList,
  House,
  KeyRound,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

type SessionResponse = {
  ok?: boolean;
  data?: { roles?: unknown };
};

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  visible: boolean;
};

export function PortalNavigation({
  showStaffTasks = false,
  showProspectLeads = false,
  variant = "mobile",
}: {
  showStaffTasks?: boolean;
  showProspectLeads?: boolean;
  variant?: "sidebar" | "mobile";
}) {
  const pathname = usePathname();
  const [managerNavigationDiscovered, setManagerNavigationDiscovered] = useState(false);

  useEffect(() => {
    if (!showStaffTasks || showProspectLeads || managerNavigationDiscovered) return;
    const controller = new AbortController();

    void fetch("/api/platform/session", {
      method: "GET",
      headers: { accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as SessionResponse;
      })
      .then((body) => {
        const roles = body?.ok && Array.isArray(body.data?.roles) ? body.data.roles : [];
        if (roles.includes("MANAGER")) setManagerNavigationDiscovered(true);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [managerNavigationDiscovered, showProspectLeads, showStaffTasks]);

  const managerNavigation = showProspectLeads || managerNavigationDiscovered;
  const items: readonly NavigationItem[] = [
    { href: "/portal", label: "Рабочий стол", icon: House, visible: true },
    { href: "/portal/tasks", label: "Задачи", icon: ClipboardList, visible: showStaffTasks },
    { href: "/portal/leads", label: "Потенциальные клиенты", icon: Users, visible: managerNavigation },
    { href: "/portal/profile", label: "Профиль", icon: UserRound, visible: true },
    { href: "/portal/notifications", label: "Уведомления", icon: Bell, visible: true },
    { href: "/portal/security", label: "Безопасность", icon: KeyRound, visible: true },
  ];

  const visibleItems = items.filter((item) => item.visible);

  if (variant === "sidebar") {
    return (
      <nav aria-label="Основная навигация защищённого кабинета" className="grid gap-1.5">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/10 ${
                active
                  ? "bg-white/[0.11] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]"
                  : "text-white/58 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-lg transition ${
                  active ? "bg-white/[0.08] text-white" : "text-white/48 group-hover:text-white/80"
                }`}
              >
                <Icon className="size-[17px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 truncate">{label}</span>
              {active ? <span className="ml-auto size-1.5 shrink-0 rounded-full bg-[#c43a42]" aria-hidden="true" /> : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Основная навигация защищённого кабинета"
      className="flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain px-5 py-3 sm:px-8 lg:hidden"
    >
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const active = href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f1720]/10 ${
              active
                ? "border-[#d9dde0] bg-white text-[#202326] shadow-sm"
                : "border-transparent text-[#6f7880] hover:bg-white/75 hover:text-[#202326]"
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
