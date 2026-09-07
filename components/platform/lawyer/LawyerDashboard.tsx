"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Clock3, FileCheck2, UsersRound } from "lucide-react";
import { LawyerRouteGuard } from "./LawyerRouteGuard";
import { PriorityBadge } from "./PriorityBadge";
import { useLawyerCases } from "./useLawyerCases";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { MetricCard, PlanBadge, PlatformCard, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { Button } from "@/components/ui/button";
import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";

export function LawyerDashboard() {
  return <LawyerRouteGuard><PlatformShell><DashboardContent /></PlatformShell></LawyerRouteGuard>;
}

function DashboardContent() {
  const cases = useLawyerCases().map((item) => item.summary);
  const reviewCount = cases.flatMap((item) => item.documents).filter((document) => document.status === "sent_for_review" || document.status === "ready_for_review").length;
  const attention = cases.filter((item) => item.priority !== "routine");
  return <div className="flex min-w-0 flex-col gap-8 sm:gap-10">
    <SectionHeader title="Рабочий стол юриста" description="Анна Орлова · Обзор клиентских дел" action={<Button render={<Link href="/app/lawyer/cases" />} nativeButton={false} className="h-11 rounded-full px-5">Все дела<ArrowRight data-icon="inline-end" /></Button>} />
    <section aria-label="Ключевые показатели" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Активных дел" value={cases.length} /><MetricCard label="Требуют внимания" value={attention.length} /><MetricCard label="Документов на проверке" value={reviewCount} /><MetricCard label="Клиентов в работе" value={cases.length} /></section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]">
      <PlatformCard className="min-w-0 overflow-hidden"><div className="border-b border-border p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Очередь</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Требуют внимания</h2></div><div className="divide-y divide-border">{attention.map((item) => <div key={item.clientCase.caseNumber} className="flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.identity.displayName}</p><PriorityBadge priority={item.priority} /></div><p className="mt-2 text-sm text-muted-foreground">{item.attentionReason}</p><p className="mt-1 text-xs text-muted-foreground">{getClientCaseDisplayNumber(item.clientCase.caseNumber)}</p></div><Button render={<Link href={`/app/lawyer/cases/${item.clientCase.caseNumber}`} />} nativeButton={false} variant="outline" className="h-10 w-full rounded-full sm:w-auto">Открыть дело</Button></div>)}</div></PlatformCard>
      <PlatformCard className="p-5 sm:p-6"><h2 className="text-2xl font-semibold tracking-[-.04em]">Последняя активность</h2><div className="mt-6 flex flex-col gap-5">{cases.map((item) => <div key={item.clientCase.caseNumber} className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-primary">{item.lastActivity.includes("Документ") ? <FileCheck2 className="size-4" /> : <Clock3 className="size-4" />}</span><div><p className="text-sm font-medium">{item.lastActivity}</p><p className="mt-1 text-xs text-muted-foreground">{item.identity.displayName} · {getClientCaseDisplayNumber(item.clientCase.caseNumber)}</p></div></div>)}</div></PlatformCard>
    </section>
    <PlatformCard className="min-w-0 overflow-hidden"><div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"><div><h2 className="text-2xl font-semibold tracking-[-.04em]">Активные дела</h2><p className="mt-2 text-sm text-muted-foreground">Единое состояние клиентских процессов</p></div><Link href="/app/lawyer/cases" className="text-sm font-semibold text-primary">Перейти к списку</Link></div><div className="divide-y divide-border">{cases.map((item) => <Link key={item.clientCase.caseNumber} href={`/app/lawyer/cases/${item.clientCase.caseNumber}`} className="grid min-w-0 gap-4 p-5 transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center sm:px-6"><div className="min-w-0"><p className="font-semibold">{item.identity.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{getClientCaseDisplayNumber(item.clientCase.caseNumber)}</p></div><div><p className="text-sm">{item.clientCase.stage}</p><p className="mt-1 text-xs text-muted-foreground">Прогресс {item.clientCase.progress}%</p></div><div className="flex items-center gap-3"><PlanBadge plan={item.clientCase.plan} /><ArrowRight className="size-4 text-muted-foreground" /></div></Link>)}</div></PlatformCard>
    <section aria-label="Быстрые действия" className="grid gap-4 sm:grid-cols-2"><Link href="/app/lawyer/cases" className="rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><PlatformCard className="flex h-full items-center gap-4 p-5 transition hover:border-primary/30"><BriefcaseBusiness className="size-6 text-primary" /><div><p className="font-semibold">Открыть очередь дел</p><p className="mt-1 text-sm text-muted-foreground">Фильтры по тарифу и вниманию</p></div></PlatformCard></Link><Link href="/app/lawyer/clients" className="rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><PlatformCard className="flex h-full items-center gap-4 p-5 transition hover:border-primary/30"><UsersRound className="size-6 text-primary" /><div><p className="font-semibold">Клиенты в работе</p><p className="mt-1 text-sm text-muted-foreground">{cases.length} активных дел</p></div></PlatformCard></Link></section>
  </div>;
}
