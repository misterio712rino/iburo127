"use client";

import { useState, type ReactNode } from "react";
import { Activity, BookOpen, BriefcaseBusiness, ChartNoAxesColumnIncreasing, ClipboardCheck, FileText, House, Menu, Sparkles, UserRound, UsersRound, X } from "lucide-react";
import { CLIENT_NAVIGATION, LAWYER_NAVIGATION } from "@/lib/platform/demo";
import type { PlatformNavItem } from "@/lib/platform/types";
import { Button } from "@/components/ui/button";
import { useDemoIdentity } from "./DemoIdentityProvider";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { IBuroBrand } from "./IBuroBrand";

const icons = { home: House, book: BookOpen, form: ClipboardCheck, files: FileText, sparkles: Sparkles, chart: ChartNoAxesColumnIncreasing, profile: UserRound, users: UsersRound, briefcase: BriefcaseBusiness, tasks: ClipboardCheck, activity: Activity };

function Navigation({ items, close }: { items: readonly PlatformNavItem[]; close?: () => void }) {
  return <nav className="flex flex-col gap-1" aria-label="Навигация платформы">{items.map((item) => { const Icon = icons[item.icon]; return item.href ? <a key={item.label} href={item.href} onClick={close} className="flex h-11 items-center gap-3 rounded-xl bg-sidebar-accent px-3 text-sm font-medium text-sidebar-accent-foreground"><Icon aria-hidden="true" />{item.label}</a> : <span key={item.label} className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-sidebar-foreground/55"><Icon aria-hidden="true" />{item.label}<span className="ml-auto text-[10px] font-semibold uppercase tracking-wider">Скоро</span></span>; })}</nav>;
}

export function PlatformShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { identity } = useDemoIdentity();
  const navigation = identity.role === "LAWYER" ? LAWYER_NAVIGATION : CLIENT_NAVIGATION.map((item) => item.label === "AI-помощник" && identity.plan !== "INDIVIDUAL" ? { label: item.label, icon: item.icon } : item);
  return <div className="min-h-screen bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground lg:flex"><a href="/app" className="mb-10 text-2xl font-semibold tracking-[-.05em]"><IBuroBrand dot /></a><Navigation items={navigation} /><div className="mt-auto rounded-2xl border border-sidebar-border p-4"><p className="text-xs font-semibold">Демонстрационный режим</p><p className="mt-1 text-xs text-sidebar-foreground/60">Данные не являются реальными.</p></div></aside>
    {open ? <div className="fixed inset-0 z-50 bg-black/35 lg:hidden" onClick={() => setOpen(false)}><aside className="h-full w-[min(82vw,20rem)] bg-sidebar p-5 text-sidebar-foreground" onClick={(event) => event.stopPropagation()}><div className="mb-8 flex items-center justify-between"><IBuroBrand dot className="text-2xl font-semibold tracking-[-.05em]" /><Button variant="ghost" size="icon" aria-label="Закрыть меню" onClick={() => setOpen(false)}><X /></Button></div><Navigation items={navigation} close={() => setOpen(false)} /></aside></div> : null}
    <div className="lg:pl-64"><header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-8"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Открыть меню" onClick={() => setOpen(true)}><Menu /></Button><p className="hidden text-sm text-muted-foreground lg:block">Платформа сопровождения</p><ProfileSwitcher /></header><main className="mx-auto max-w-7xl p-4 sm:p-8 lg:p-10">{children}</main></div>
  </div>;
}
