import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, Clock3, FileText, History } from "lucide-react";
import { TaskStatusControl } from "@/components/platform/tasks/TaskStatusControl";
import type { StaffTaskQueueItem } from "@/server/tasks/staff-task-view";

const STATUS_LABELS = {
  NEW: "Новая",
  WORKING: "В работе",
  DONE: "Выполнена",
} as const;

function dueLabel(dueAt: Date | null) {
  return dueAt
    ? dueAt.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
}

export function StaffTaskList({
  items,
  emptyMessage = "Доступных задач сейчас нет.",
}: {
  items: readonly StaffTaskQueueItem[];
  emptyMessage?: string;
}) {
  if (!items.length) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm leading-6 text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map(({ task, clientCase }) => {
        const caseHref = `/portal/cases/${encodeURIComponent(clientCase.id)}`;
        const due = dueLabel(task.dueAt);

        return (
          <article
            key={task.id}
            className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_14px_45px_rgba(15,23,42,0.07)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link
                  href={caseHref}
                  className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.08em] text-slate-400 transition hover:text-[#7B2330]"
                >
                  <BriefcaseBusiness className="size-3.5" aria-hidden="true" />
                  {clientCase.caseNumber}
                </Link>
                <p className="mt-2 text-lg font-bold text-slate-900">{task.title}</p>
                {task.description ? (
                  <p className="mt-2 text-sm leading-6 text-slate-500">{task.description}</p>
                ) : null}
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                {STATUS_LABELS[task.status]}
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
              <div>
                <dt className="text-slate-400">Этап дела</dt>
                <dd className="mt-1 font-semibold text-slate-700">{clientCase.stageCode}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Тариф</dt>
                <dd className="mt-1 font-semibold text-slate-700">{clientCase.planCode}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>Версия {task.version}</span>
              {due ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  До {due}
                </span>
              ) : null}
            </div>

            <TaskStatusControl taskId={task.id} status={task.status} version={task.version} />

            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Link
                href={caseHref}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700"
              >
                Открыть дело <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
              <Link
                href={`${caseHref}/documents`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                <FileText className="size-3.5" aria-hidden="true" /> Документы
              </Link>
              <Link
                href={`${caseHref}/activity`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                <History className="size-3.5" aria-hidden="true" /> История
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
