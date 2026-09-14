"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LawyerRouteGuard } from "./LawyerRouteGuard";
import { PriorityBadge } from "./PriorityBadge";
import { useLawyerCases } from "./useLawyerCases";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { PlanBadge, ProgressBar, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";
import type { PlanCode } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "ATTENTION" | PlanCode;
const FILTERS: readonly { code: Filter; label: string }[] = [{ code: "ALL", label: "Все" }, { code: "ATTENTION", label: "Требуют внимания" }, { code: "LITE", label: "ЛАЙТ" }, { code: "PRO", label: "ПРО" }, { code: "INDIVIDUAL", label: "ЭКСКЛЮЗИВ" }];

export function LawyerCasesList() { return <LawyerRouteGuard><PlatformShell><CasesContent /></PlatformShell></LawyerRouteGuard>; }
function CasesContent() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const cases = useLawyerCases().map((item) => item.summary).filter((item) => filter === "ALL" || filter === "ATTENTION" ? filter === "ALL" || item.priority !== "routine" : item.clientCase.plan === filter);
  return <div className="flex min-w-0 flex-col gap-7 sm:gap-9"><SectionHeader title="Клиентские дела" description="Текущие этапы, прогресс и очередь проверки." /><div role="group" aria-label="Фильтр дел" className="flex max-w-full gap-2 overflow-x-auto pb-1">{FILTERS.map((item) => <button key={item.code} type="button" aria-pressed={filter === item.code} onClick={() => setFilter(item.code)} className={cn("shrink-0 rounded-full border border-border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15", filter === item.code ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{item.label}</button>)}</div><div className="overflow-hidden rounded-[1.4rem] border border-border bg-card shadow-[0_18px_50px_rgba(0,0,0,.05)]"><div className="hidden grid-cols-[1.2fr_.8fr_1fr_.75fr_.8fr_auto] gap-4 border-b border-border bg-muted/40 px-6 py-3 text-xs font-semibold text-muted-foreground lg:grid"><span>Клиент</span><span>Тариф</span><span>Этап</span><span>Анкета</span><span>Документы</span><span>Приоритет</span></div><div className="divide-y divide-border">{cases.map((item) => { const sent=item.documents.filter((document)=>document.status==="sent_for_review").length; const ready=item.documents.filter((document)=>document.status==="ready_for_review").length; return <Link href={`/app/lawyer/cases/${item.clientCase.caseNumber}`} key={item.clientCase.caseNumber} className="grid min-w-0 gap-5 p-5 transition hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 lg:grid-cols-[1.2fr_.8fr_1fr_.75fr_.8fr_auto] lg:items-center lg:px-6"><div className="min-w-0"><p className="font-semibold">{item.identity.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{getClientCaseDisplayNumber(item.clientCase.caseNumber)}</p><div className="mt-3 lg:hidden"><ProgressBar value={item.clientCase.progress} /></div></div><div><span className="mb-1 block text-xs text-muted-foreground lg:hidden">Тариф</span><PlanBadge plan={item.clientCase.plan} /></div><div><span className="mb-1 block text-xs text-muted-foreground lg:hidden">Этап</span><p className="text-sm font-medium">{item.clientCase.stage}</p><p className="mt-1 text-xs text-muted-foreground">{item.clientCase.progress}%</p></div><div><span className="mb-1 block text-xs text-muted-foreground lg:hidden">Анкета</span><p className="text-sm">{item.questionnaire.progress}% · {item.questionnaire.completedCount}/10</p></div><div><span className="mb-1 block text-xs text-muted-foreground lg:hidden">Документы</span><p className="text-sm">{sent ? `${sent} передано` : ready ? `${ready} готово` : "Нет в очереди"}</p></div><div className="flex items-center justify-between gap-3"><PriorityBadge priority={item.priority} /><ArrowRight className="size-4 text-muted-foreground" /></div></Link>; })}{!cases.length ? <p className="p-8 text-center text-sm text-muted-foreground">По выбранному фильтру дел нет.</p> : null}</div></div></div>;
}
