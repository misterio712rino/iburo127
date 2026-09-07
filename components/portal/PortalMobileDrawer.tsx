"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    if (open) window.requestAnimationFrame(() => setOpen(false));
  }, [open, pathname]);

  useEffect(() => {
    if (!open) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <div className="flex min-h-[68px] w-full items-center justify-between gap-3 lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Открыть меню"
          aria-expanded={open}
          aria-controls={drawerId}
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
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside ref={drawerRef} id={drawerId} className="relative flex h-full w-[min(86vw,330px)] flex-col bg-[#202b33] px-5 py-5 text-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <Link href="/portal" onClick={() => setOpen(false)} className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/10">
                <IBuroBrand dot className="font-[var(--font-iburo-display)] text-[30px] font-semibold tracking-[-0.045em]" />
              </Link>
              <button
                ref={closeButtonRef}
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
