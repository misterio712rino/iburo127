import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Clock3,
  UserRound,
} from "lucide-react";

import { TaskStatusControl } from "@/components/platform/tasks/TaskStatusControl";
import type { StaffTaskPresentationItem } from "@/server/tasks/staff-task-view";

const STATUS_LABELS = {
  NEW: "Новая",
  WORKING: "В работе",
  DONE: "Выполнена",
} as const;

const STATUS_STYLES = {
  NEW: "text-slate-500",
  WORKING: "text-amber-700",
  DONE: "text-emerald-700",
} as const;

function dueText(item: StaffTaskPresentationItem) {
  if (item.dueState === "NO_DUE_DATE") return "Срок не назначен";
  if (item.dueState === "OVERDUE") return `Срок истёк: ${item.dueLabel}`;
  return `Срок: ${item.dueLabel}`;
}

export function StaffTaskCards({
  items,
  emptyMessage = "Доступных задач сейчас нет.",
}: {
  items: readonly StaffTaskPresentationItem[];
  emptyMessage?: string;
}) {
  if (!items.length) {
    return <div className="rounded-[20px] border border-dashed border-slate-300 bg-white/60 p-7 text-sm leading-6 text-slate-500">{emptyMessage}</div>;
  }

  return (
    <div className="grid min-w-0 gap-3">
      {items.map((item) => (
        <article
          key={item.taskId}
          className={`min-w-0 rounded-[20px] border bg-white p-4 transition-colors sm:p-5 ${item.isOverdue ? "border-[#b41f2b]/25" : "border-[#e2e5e7]"} ${item.status === "DONE" ? "bg-white/70" : ""}`}
        >
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(13rem,.65fr)_auto] xl:items-center">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-[0.07em] ${STATUS_STYLES[item.status]}`}>{STATUS_LABELS[item.status]}</span>
                {item.isOverdue ? <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#a51b25]">Просрочено</span> : null}
                <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs ${item.isOverdue ? "font-semibold text-[#a51b25]" : "text-slate-400"}`}>
                  <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="break-words">{dueText(item)}</span>
                </span>
              </div>

              <h2 className="mt-2 break-words text-base font-bold leading-6 text-slate-900 sm:text-[17px]">{item.title}</h2>
              {item.description ? <p className="mt-1.5 max-w-3xl break-words text-sm leading-5 text-slate-500">{item.description}</p> : null}

              <Link
                href={item.caseHref}
                aria-label={`Открыть дело ${item.caseNumber}${item.clientDisplayName ? ` клиента ${item.clientDisplayName}` : ""}`}
                className="mt-2 inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg text-sm font-semibold text-slate-700 transition-colors hover:text-[#8f1720] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f1720]/15"
              >
                <BriefcaseBusiness className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  {item.clientDisplayName ?? "Имя клиента не указано"}
                  <span className="ml-2 font-mono text-[11px] text-slate-400">{item.caseNumber}</span>
                </span>
              </Link>
            </div>

            <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 border-y border-slate-100 py-3 text-xs xl:grid-cols-1 xl:border-y-0 xl:border-l xl:py-1 xl:pl-5">
              <div className="min-w-0">
                <dt className="text-slate-400">Этап · тариф</dt>
                <dd className="mt-0.5 break-words font-semibold text-slate-700">{item.stageLabel} · {item.planLabel}</dd>
              </div>
              <div className="min-w-0">
                <dt className="inline-flex items-center gap-1.5 text-slate-400"><UserRound className="size-3.5" aria-hidden="true" />Исполнитель</dt>
                <dd className="mt-0.5 break-words font-semibold text-slate-700">{item.assigneeDisplayName ?? "Не указан"}</dd>
              </div>
              {item.status === "DONE" && item.completedLabel ? (
                <div className="col-span-2 min-w-0 xl:col-span-1">
                  <dt className="text-slate-400">Завершено</dt>
                  <dd className="mt-0.5 font-semibold text-emerald-700">{item.completedLabel}</dd>
                </div>
              ) : null}
            </dl>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap xl:flex-nowrap xl:justify-end">
              {item.status !== "DONE" ? (
                <div className="min-w-0 flex-1 [&>div]:mt-0 [&_button]:w-full">
                  <TaskStatusControl taskId={item.taskId} status={item.status} version={item.version} />
                </div>
              ) : null}
              <Link
                href={item.caseHref}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f1720]/10"
              >
                Открыть дело <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
