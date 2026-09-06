"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, FileText, Search, Settings2, UserRound } from "lucide-react";
import { LawyerRouteGuard } from "./LawyerRouteGuard";
import { useLawyerCases } from "./useLawyerCases";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { PlatformCard, SectionHeader } from "@/components/platform/PlatformPrimitives";

type Category = "clients" | "documents" | "tasks" | "system";
type Period = "today" | "yesterday" | "week";
type Filter = "all" | Category;
type ActivityEvent = { id: string; category: Category; period: Period; title: string; client: string; caseNumber: string; timestamp: string; order: number };

const filters: readonly { id: Filter; label: string }[] = [{ id: "all", label: "Все" }, { id: "clients", label: "Клиенты" }, { id: "documents", label: "Документы" }, { id: "tasks", label: "Задачи" }, { id: "system", label: "Система" }];
const periods: readonly { id: Period; label: string }[] = [{ id: "today", label: "Сегодня" }, { id: "yesterday", label: "Вчера" }, { id: "week", label: "На этой неделе" }];
const categoryLabel: Record<Category, string> = { clients: "Клиент", documents: "Документы", tasks: "Задачи", system: "Система" };
const categoryStyle: Record<Category, string> = { clients: "bg-muted text-foreground", documents: "bg-primary/10 text-primary", tasks: "bg-[#718b9a]/12 text-[#536f81]", system: "bg-[#7a746c]/10 text-muted-foreground" };

const baseEvents: readonly ActivityEvent[] = [
  { id: "m-property", category: "clients", period: "today", title: "Мария Соколова обновила сведения об имуществе", client: "Мария Соколова", caseNumber: "IBR-2026-000102", timestamp: "Сегодня, 12:45", order: 1 },
  { id: "d-application", category: "documents", period: "today", title: "Сформировано заявление о признании гражданина банкротом", client: "Дмитрий Волков", caseNumber: "IBR-2026-000103", timestamp: "Сегодня, 11:20", order: 2 },
  { id: "d-review-task", category: "tasks", period: "today", title: "Задача «Проверить заявление» добавлена в очередь", client: "Дмитрий Волков", caseNumber: "IBR-2026-000103", timestamp: "Сегодня, 10:05", order: 3 },
  { id: "a-lesson", category: "clients", period: "today", title: "Александр Лебедев завершил третий урок Практикума", client: "Александр Лебедев", caseNumber: "IBR-2026-000101", timestamp: "Сегодня, 09:42", order: 4 },
  { id: "m-stage", category: "system", period: "yesterday", title: "Дело переведено на этап «Анкета»", client: "Мария Соколова", caseNumber: "IBR-2026-000102", timestamp: "Вчера, 17:30", order: 5 },
  { id: "d-inventory", category: "documents", period: "yesterday", title: "Подготовлена опись имущества", client: "Дмитрий Волков", caseNumber: "IBR-2026-000103", timestamp: "Вчера, 16:15", order: 6 },
  { id: "m-form-task", category: "tasks", period: "yesterday", title: "Анна Орлова взяла в работу проверку анкеты", client: "Мария Соколова", caseNumber: "IBR-2026-000102", timestamp: "Вчера, 14:10", order: 7 },
  { id: "d-questionnaire", category: "clients", period: "yesterday", title: "Дмитрий Волков завершил заполнение анкеты", client: "Дмитрий Волков", caseNumber: "IBR-2026-000103", timestamp: "Вчера, 11:50", order: 8 },
  { id: "d-stage", category: "system", period: "week", title: "Дело переведено на этап «Подготовка документов»", client: "Дмитрий Волков", caseNumber: "IBR-2026-000103", timestamp: "12 августа, 15:20", order: 9 },
  { id: "m-mortgage", category: "clients", period: "week", title: "Мария Соколова добавила сведения об ипотеке", client: "Мария Соколова", caseNumber: "IBR-2026-000102", timestamp: "12 августа, 12:05", order: 10 },
  { id: "a-progress-task", category: "tasks", period: "week", title: "Создана задача контроля прогресса обучения", client: "Александр Лебедев", caseNumber: "IBR-2026-000101", timestamp: "11 августа, 10:30", order: 11 },
  { id: "d-creditors", category: "documents", period: "week", title: "Подготовлен список кредиторов и должников", client: "Дмитрий Волков", caseNumber: "IBR-2026-000103", timestamp: "10 августа, 16:40", order: 12 },
];

export function LawyerActivity() { return <LawyerRouteGuard><PlatformShell><ActivityContent /></PlatformShell></LawyerRouteGuard>; }

function ActivityContent() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const cases = useLawyerCases().map((item) => item.summary);
  const supportedCaseNumbers = new Set(cases.map((item) => item.clientCase.caseNumber));
  const persistedEvents: ActivityEvent[] = cases.flatMap((item, caseIndex) => item.documents.filter((document) => document.status === "sent_for_review" || document.status === "reviewed").map((document, documentIndex) => ({ id: `state-${item.identity.id}-${document.definition.id}-${document.status}`, category: "documents", period: "today", title: document.status === "reviewed" ? `Документ «${document.definition.title}» проверен юристом` : `${item.identity.displayName} передал документ «${document.definition.title}» на проверку`, client: item.identity.displayName, caseNumber: item.clientCase.caseNumber, timestamp: document.status === "reviewed" ? "Сегодня, обновлено" : "Сегодня, передано на проверку", order: -10 + caseIndex + documentIndex })));
  const normalized = query.trim().toLocaleLowerCase("ru-RU");
  const visible = [...persistedEvents, ...baseEvents.filter((event) => supportedCaseNumbers.has(event.caseNumber))].filter((event) => (filter === "all" || event.category === filter) && (!normalized || `${event.client} ${event.caseNumber} ${event.title}`.toLocaleLowerCase("ru-RU").includes(normalized))).sort((a, b) => a.order - b.order);
  const emptyText = normalized ? "По вашему запросу ничего не найдено" : "Событий по выбранному фильтру нет";

  return <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
    <SectionHeader title="Активность" description="Единая лента событий по клиентам и делам." />
    <PlatformCard className="min-w-0 p-3 sm:p-4"><div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><label className="relative block w-full lg:max-w-sm"><span className="sr-only">Поиск по клиенту или номеру дела</span><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по клиенту или номеру дела" className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10" /></label><div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Фильтры активности">{filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)} className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 ${filter === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}</div></div></PlatformCard>
    <div aria-live="polite" className="flex min-w-0 flex-col gap-5">{periods.map((period) => { const events = visible.filter((event) => event.period === period.id); return events.length ? <section key={period.id} aria-labelledby={`activity-${period.id}`}><div className="mb-2.5 flex items-center gap-3"><h2 id={`activity-${period.id}`} className="text-sm font-bold uppercase tracking-[.12em] text-muted-foreground">{period.label}</h2><span className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">{events.length}</span></div><PlatformCard className="min-w-0 overflow-hidden"><div className="divide-y divide-border">{events.map((event) => <EventRow key={event.id} event={event} />)}</div></PlatformCard></section> : null; })}{!visible.length ? <PlatformCard className="grid min-h-40 place-items-center p-6 text-center"><div><CheckCircle2 className="mx-auto size-7 text-primary" /><p className="mt-3 font-semibold">{emptyText}</p><p className="mt-1 text-sm text-muted-foreground">Измените фильтр или поисковый запрос.</p></div></PlatformCard> : null}</div>
  </div>;
}

function EventRow({ event }: { event: ActivityEvent }) {
  const href = `/app/lawyer/cases/${event.caseNumber}`;
  const Icon = event.category === "documents" ? FileText : event.category === "clients" ? UserRound : event.category === "tasks" ? ClipboardCheck : Settings2;
  return <article className="grid min-w-0 gap-3 px-4 py-3.5 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-5 sm:py-3">
    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${categoryStyle[event.category]}`}><Icon className="size-4" aria-hidden="true" /></span>
    <div className="min-w-0"><h3 className="text-sm font-semibold leading-5">{event.title}</h3><div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><Link href={href} className="font-medium text-foreground hover:text-primary">{event.client}</Link><span aria-hidden="true">·</span><Link href={href} className="font-mono hover:text-primary">{event.caseNumber}</Link><span aria-hidden="true">·</span><span className={`rounded-full px-2 py-0.5 font-semibold ${categoryStyle[event.category]}`}>{categoryLabel[event.category]}</span></div></div>
    <time className="pl-[3.25rem] text-xs text-muted-foreground sm:pl-0 sm:text-right">{event.timestamp}</time>
  </article>;
}
