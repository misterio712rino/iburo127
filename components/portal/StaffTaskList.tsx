import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, Clock3, FileText, History } from "lucide-react";
import { TaskStatusControl } from "@/components/platform/tasks/TaskStatusControl";
import {
  getCaseStageDisplayLabel,
  getPlanDisplayLabel,
} from "@/lib/platform/case-progress";
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
  canMutate,
  emptyMessage = "Доступных задач сейчас нет.",
}: {
  items: readonly StaffTaskQueueItem[];
  canMutate: boolean;
  emptyMessage?: string;
}) {
  if (!items.length) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm leading-6 text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map(({ task, clientCase }) => {
        const caseHref = `/portal/cases/${encodeURIComponent(clientCase.id)}`;
        const due = dueLabel(task.dueAt);
        const overdue =
          task.status !== "DONE" && Boolean(task.dueAt && task.dueAt.getTime() < now.getTime());

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
                <p className="mt-2 break-words text-lg font-bold text-slate-900">{task.title}</p>
                {task.description ? (
                  <p className="mt-2 break-words text-sm leading-6 text-slate-500">{task.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                  {STATUS_LABELS[task.status]}
                </span>
                {overdue ? (
                  <span className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700">
                    Просрочено
                  </span>
                ) : null}
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
              <div>
                <dt className="text-slate-400">Этап дела</dt>
                <dd className="mt-1 font-semibold text-slate-700">
                  {getCaseStageDisplayLabel(clientCase.stageCode, "STAFF")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Тариф</dt>
                <dd className="mt-1 font-semibold text-slate-700">
                  {getPlanDisplayLabel(clientCase.planCode, "STAFF")}
                </dd>
              </div>
            </dl>

            {due ? (
              <div className={`mt-4 inline-flex items-center gap-1.5 text-xs ${overdue ? "font-semibold text-red-700" : "text-slate-400"}`}>
                <Clock3 className="size-3.5" aria-hidden="true" />
                {overdue ? "Срок был" : "Срок"} {due}
              </div>
            ) : null}

            {canMutate ? (
              <TaskStatusControl taskId={task.id} status={task.status} version={task.version} />
            ) : null}

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
