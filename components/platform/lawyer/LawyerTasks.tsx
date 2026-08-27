"use client";

import { useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, CheckCircle2, Clock3, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LawyerRouteGuard } from "./LawyerRouteGuard";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { PlatformCard, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { DEMO_CASES } from "@/lib/platform/demo/cases";
import { DEMO_IDENTITIES, LAWYER_IDENTITY } from "@/lib/platform/demo/identities";
import { DEMO_TASKS, type DemoTask, type DemoTaskGroup, type DemoTaskStatus } from "@/lib/platform/demo/tasks";
import type { PlanCode } from "@/lib/platform/types";
import { useTaskState, type TaskState } from "@/lib/platform/workflows/tasks/useTaskState";

type TaskGroup = DemoTaskGroup;
export type LawyerTaskStatus = DemoTaskStatus;
type Filter = "all" | "urgent" | "today" | "week" | "working" | "done";
export type LawyerTaskState = TaskState;
export type LawyerTask = DemoTask & { client: string; caseNumber: string; plan: "LITE" | "PRO" | "ИНДИВИДУАЛЬНЫЙ" };

const SUPPORTED_LAWYER_CLIENT_IDS = new Set(DEMO_IDENTITIES.filter((identity) => identity.role === "CLIENT").map((identity) => identity.id));
function lawyerPlanLabel(plan: PlanCode): LawyerTask["plan"] { return plan === "INDIVIDUAL" ? "ИНДИВИДУАЛЬНЫЙ" : plan; }

export const LAWYER_TASKS: readonly LawyerTask[] = DEMO_TASKS
  .filter((task) => task.assignedEmployeeId === LAWYER_IDENTITY.id && SUPPORTED_LAWYER_CLIENT_IDS.has(task.clientId))
  .map((task) => {
    const client = DEMO_IDENTITIES.find((identity) => identity.id === task.clientId)!;
    const clientCase = DEMO_CASES.find((item) => item.clientId === task.clientId)!;
    return { ...task, client: client.displayName, caseNumber: clientCase.caseNumber, plan: lawyerPlanLabel(clientCase.plan) };
  });

const filters: readonly { id: Filter; label: string }[] = [{ id: "all", label: "Все" }, { id: "urgent", label: "Срочные" }, { id: "today", label: "Сегодня" }, { id: "week", label: "Неделя" }, { id: "working", label: "В работе" }, { id: "done", label: "Завершённые" }];
const groupLabel: Record<TaskGroup, string> = { overdue: "Просрочено", urgent: "Срочно", today: "Сегодня", week: "На неделе" };
const groupStyle: Record<TaskGroup, string> = { overdue: "border-[#8f1720]/25 bg-[#8f1720]/10 text-[#8f1720]", urgent: "border-primary/25 bg-primary/10 text-primary", today: "border-[#a65a3a]/20 bg-[#a65a3a]/10 text-[#8b4c32]", week: "border-border bg-muted text-muted-foreground" };

export function LawyerTasks() { return <LawyerRouteGuard><PlatformShell><TasksContent /></PlatformShell></LawyerRouteGuard>; }

export function useLawyerTaskSnapshot() {
  return useTaskState().state;
}

function TasksContent() {
  const tasks = useTaskState();
  const state = tasks.state;
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const statusOf = tasks.statusOf;
  const update = tasks.update;

  const counts = {
    urgent: LAWYER_TASKS.filter((task) => task.group === "urgent" && statusOf(task.id) !== "done").length,
    today: LAWYER_TASKS.filter((task) => (task.group === "today" || task.group === "urgent") && statusOf(task.id) !== "done").length,
    working: LAWYER_TASKS.filter((task) => statusOf(task.id) === "working").length,
    overdue: LAWYER_TASKS.filter((task) => task.group === "overdue" && statusOf(task.id) !== "done").length,
  };

  const visible = (() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return LAWYER_TASKS.filter((task) => {
      const status = statusOf(task.id);
      const matchesFilter = filter === "all" || filter === "working" && status === "working" || filter === "done" && status === "done" || filter === "urgent" && (task.group === "urgent" || task.group === "overdue") && status !== "done" || filter === "today" && (task.group === "today" || task.group === "urgent") && status !== "done" || filter === "week" && task.group === "week" && status !== "done";
      const haystack = `${task.client} ${task.caseNumber} ${task.title}`.toLocaleLowerCase("ru-RU");
      return matchesFilter && (!normalized || haystack.includes(normalized));
    }).sort((a, b) => taskRank(a, statusOf(a.id)) - taskRank(b, statusOf(b.id)) || a.dueOrder - b.dueOrder);
  })();

  const emptyText = query ? "По вашему запросу задач не найдено" : filter === "urgent" ? "Срочных задач нет" : filter === "today" ? "Все задачи на сегодня выполнены" : filter === "done" ? "Завершённых задач пока нет" : filter === "working" ? "Задач в работе нет" : "В этой категории задач нет";

  return <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
    <SectionHeader title="Задачи" description="Операционная очередь по активным клиентским делам." />
    <section aria-label="Сводка задач" className="grid grid-cols-2 gap-3 xl:grid-cols-4"><CompactMetric label="Срочные" value={counts.urgent} tone="urgent" /><CompactMetric label="Сегодня" value={counts.today} tone="today" /><CompactMetric label="В работе" value={counts.working} tone="working" /><CompactMetric label="Просрочено" value={counts.overdue} tone="overdue" /></section>
    <PlatformCard className="min-w-0 p-3 sm:p-4"><div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><label className="relative block w-full lg:max-w-sm"><span className="sr-only">Поиск по клиенту или номеру дела</span><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по клиенту или номеру дела" className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10" /></label><div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Фильтры задач">{filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${filter === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}</div></div></PlatformCard>
    <section aria-live="polite" aria-label="Очередь задач" className="grid gap-2.5">{visible.length ? visible.map((task) => <TaskRow key={task.id} task={task} status={statusOf(task.id)} onUpdate={update} />) : <PlatformCard className="grid min-h-36 place-items-center p-6 text-center"><div><CheckCircle2 className="mx-auto size-7 text-primary" /><p className="mt-3 font-semibold">{emptyText}</p><p className="mt-1 text-sm text-muted-foreground">Измените фильтр или поисковый запрос.</p></div></PlatformCard>}</section>
  </div>;
}

function taskRank(task: LawyerTask, status: LawyerTaskStatus) { if (status === "done") return 6; if (task.group === "overdue") return 0; if (task.group === "urgent") return 1; if (task.group === "today") return 2; if (status === "working") return 3; return 4; }

function CompactMetric({ label, value, tone }: { label: string; value: number; tone: "urgent" | "today" | "working" | "overdue" }) {
  const colors = tone === "overdue" || tone === "urgent" ? "text-primary" : tone === "working" ? "text-[#536f81]" : "text-[#8b5d45]";
  return <PlatformCard className="px-4 py-3.5"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-muted-foreground">{label}</p><strong className={`text-2xl leading-none ${colors}`}>{value}</strong></div></PlatformCard>;
}

function TaskRow({ task, status, onUpdate }: { task: LawyerTask; status: LawyerTaskStatus; onUpdate: (id: string, value: LawyerTaskStatus) => void }) {
  const caseHref = `/app/lawyer/cases/${task.caseNumber}`;
  const badgeLabel = status === "done" ? "Завершено" : groupLabel[task.group];
  const badgeStyle = status === "done" ? "border-border bg-muted text-muted-foreground" : groupStyle[task.group];
  return <PlatformCard className={`min-w-0 px-4 py-4 sm:px-5 ${status === "done" ? "bg-muted/45 opacity-80" : status === "working" ? "border-[#7894a5]/35 bg-[#7894a5]/5" : ""}`}>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(13rem,.7fr)_auto] lg:items-center">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${badgeStyle}`}>{badgeLabel}</span><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{task.due}</span></div><h2 className="mt-2.5 text-base font-semibold leading-5 sm:text-[1.05rem]">{task.title}</h2><Link href={caseHref} className="mt-2 inline-flex min-w-0 items-center gap-2 text-sm font-medium hover:text-primary"><UserRound className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{task.client}</span></Link></div>
      <div className="min-w-0 text-xs text-muted-foreground"><Link href={caseHref} className="font-mono text-foreground hover:text-primary">{task.caseNumber}</Link><p className="mt-1.5">{task.plan} · {task.category}</p>{status === "working" ? <p className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[#536f81]"><BriefcaseBusiness className="size-3.5" />В работе · Анна Орлова</p> : status === "done" ? <p className="mt-2 inline-flex items-center gap-1.5 font-semibold text-muted-foreground"><CheckCircle2 className="size-3.5" />Завершено</p> : null}</div>
      <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">{status !== "new" ? <Button render={<Link href={caseHref} />} nativeButton={false} variant="outline" className="h-10 w-full rounded-full px-4 sm:w-auto">Открыть дело</Button> : null}{status === "new" ? <Button className="h-10 w-full rounded-full px-4 sm:w-auto" onClick={() => onUpdate(task.id, "working")}>Взять в работу</Button> : status === "working" ? <Button className="h-10 w-full rounded-full px-4 sm:w-auto" onClick={() => onUpdate(task.id, "done")}>Завершить</Button> : null}</div>
    </div>
  </PlatformCard>;
}
