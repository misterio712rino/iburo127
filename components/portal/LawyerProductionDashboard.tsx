import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ListTodo,
} from "lucide-react";

import { PortalFrame } from "@/components/portal/PortalFrame";
import {
  buildCaseProgressSummary,
  getCaseStageDisplayLabel,
  getCaseStatusLabel,
  getPlanDisplayLabel,
} from "@/lib/platform/case-progress";
import type { ClientCaseRecord } from "@/server/domain/client-cases/contracts";
import type { TaskRecord } from "@/server/domain/tasks/contracts";
import {
  buildStaffTaskQueue,
  summarizeStaffTaskQueue,
} from "@/server/tasks/staff-task-view";

type CaseProgressSummary = ReturnType<typeof buildCaseProgressSummary>;

type LawyerProductionDashboardProps = {
  cases: readonly ClientCaseRecord[];
  tasks: readonly TaskRecord[];
  progressEntries: readonly {
    caseId: string;
    summary: CaseProgressSummary;
  }[];
};

const dueDate = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
});

export function LawyerProductionDashboard({
  cases,
  tasks,
  progressEntries,
}: LawyerProductionDashboardProps) {
  const now = new Date();
  const taskQueue = buildStaffTaskQueue(tasks, cases, now);
  const taskSummary = summarizeStaffTaskQueue(taskQueue, now);
  const progressByCase = new Map(progressEntries.map((entry) => [entry.caseId, entry.summary] as const));
  const openQueue = taskQueue.filter(({ task }) => task.status !== "DONE");
  const activeCases = cases.filter((clientCase) => clientCase.status === "ACTIVE");
  const attentionCaseIds = new Set(
    openQueue
      .filter(({ task }) => task.dueAt && task.dueAt.getTime() < now.getTime())
      .map(({ clientCase }) => clientCase.id),
  );

  return (
    <PortalFrame sectionLabel="Рабочий стол юриста" showStaffTasks>
      <section className="py-8 sm:py-10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8f1720]">
              Юридическое сопровождение
            </p>
            <h1 className="mt-3 font-[var(--font-iburo-display)] text-4xl font-semibold leading-[0.98] tracking-[-0.035em] text-[#202326] sm:text-5xl">
              Рабочий стол юриста
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#6f7880] sm:text-base">
              Дела и задачи, доступные вашей учётной записи. Приоритет формируется только из фактических сроков и статусов задач.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/portal/tasks"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#202b33] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#2b3943]"
            >
              Открыть задачи
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Активные дела"
            value={activeCases.length}
            icon={BriefcaseBusiness}
            detail={`Всего доступно: ${cases.length}`}
          />
          <MetricCard
            label="Открытые задачи"
            value={taskSummary.new + taskSummary.working}
            icon={ListTodo}
            detail={`Новые: ${taskSummary.new}`}
          />
          <MetricCard
            label="В работе"
            value={taskSummary.working}
            icon={Clock3}
            detail="Статус WORKING"
          />
          <MetricCard
            label="Просрочены"
            value={taskSummary.overdue}
            icon={AlertTriangle}
            detail="Только незавершённые"
            alert={taskSummary.overdue > 0}
          />
        </dl>
      </section>

      <div className="grid gap-6 pb-12 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
        <section aria-labelledby="lawyer-cases-heading" className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#92999e]">Дела</p>
              <h2 id="lawyer-cases-heading" className="mt-1 text-xl font-bold tracking-[-0.02em] text-[#202326]">
                Текущая работа
              </h2>
            </div>
            <span className="rounded-full border border-[#dfe3e6] bg-white px-3 py-1.5 text-xs font-semibold text-[#6f7880]">
              {cases.length}
            </span>
          </div>

          {cases.length ? (
            <div className="overflow-hidden rounded-[22px] border border-[#dfe3e6] bg-white shadow-[0_12px_40px_rgba(23,32,42,0.045)]">
              <div className="divide-y divide-[#edf0f2]">
                {cases.map((clientCase) => {
                  const progress = progressByCase.get(clientCase.id);
                  const needsAttention = attentionCaseIds.has(clientCase.id);

                  return (
                    <article key={clientCase.id} className="group p-5 transition hover:bg-[#fafbfb] sm:p-6">
                      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-[#899198]">
                              {clientCase.caseNumber}
                            </span>
                            <span className="rounded-full bg-[#f1f3f4] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#687178]">
                              {getCaseStatusLabel(clientCase.status)}
                            </span>
                            {needsAttention ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-rose-700">
                                <AlertTriangle className="size-3" aria-hidden="true" />
                                Есть просрочка
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-3 text-lg font-bold tracking-[-0.02em] text-[#202326]">
                            Тариф «{getPlanDisplayLabel(clientCase.planCode, "STAFF")}»
                          </h3>

                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#6f7880]">
                            <span>
                              Этап: <strong className="font-semibold text-[#3f474d]">{getCaseStageDisplayLabel(clientCase.stageCode, "STAFF")}</strong>
                            </span>
                            {progress?.stage.position ? (
                              <span>
                                Этап {progress.stage.position} из {progress.stage.total}
                              </span>
                            ) : null}
                          </div>

                          {progress?.nextAction ? (
                            <div className="mt-4 rounded-xl border border-[#e7eaec] bg-[#f7f8f8] px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#92999e]">Следующее действие</p>
                              <p className="mt-1 text-sm font-semibold text-[#3a4248]">{progress.nextAction.title}</p>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <Link
                            href={`/portal/cases/${clientCase.id}`}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#dfe3e6] bg-white px-3.5 py-2.5 text-sm font-bold text-[#3e464c] transition group-hover:border-[#ccd2d6] hover:bg-[#f4f6f7]"
                          >
                            Открыть
                            <ChevronRight className="size-4" aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState text="Назначенных вам дел пока нет." />
          )}
        </section>

        <section aria-labelledby="lawyer-priority-heading" className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#92999e]">Задачи</p>
              <h2 id="lawyer-priority-heading" className="mt-1 text-xl font-bold tracking-[-0.02em] text-[#202326]">
                Приоритет сейчас
              </h2>
            </div>
            <Link href="/portal/tasks" className="text-sm font-bold text-[#7b2330] hover:text-[#991f2b]">
              Все задачи
            </Link>
          </div>

          {openQueue.length ? (
            <div className="overflow-hidden rounded-[22px] border border-[#dfe3e6] bg-white shadow-[0_12px_40px_rgba(23,32,42,0.045)]">
              <div className="divide-y divide-[#edf0f2]">
                {openQueue.slice(0, 6).map(({ task, clientCase }) => {
                  const overdue = Boolean(task.dueAt && task.dueAt.getTime() < now.getTime());

                  return (
                    <article key={task.id} className="p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${overdue ? "bg-rose-50 text-rose-700" : task.status === "WORKING" ? "bg-amber-50 text-amber-700" : "bg-[#f1f3f4] text-[#657078]"}`}>
                          {overdue ? <AlertTriangle className="size-4" aria-hidden="true" /> : task.status === "WORKING" ? <Clock3 className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold leading-5 text-[#2e353a]">{task.title}</p>
                          <p className="mt-1 font-mono text-[10px] font-semibold tracking-[0.04em] text-[#9aa1a6]">{clientCase.caseNumber}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className={overdue ? "font-bold text-rose-700" : "text-[#7b848a]"}>
                              {task.dueAt ? `${overdue ? "Просрочено" : "Срок"}: ${dueDate.format(task.dueAt)}` : "Без срока"}
                            </span>
                            <span className="text-[#b0b5b9]">·</span>
                            <span className="font-semibold text-[#687178]">{task.status === "WORKING" ? "В работе" : "Новая"}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState text="Открытых задач сейчас нет." />
          )}
        </section>
      </div>
    </PortalFrame>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  detail,
  alert = false,
}: {
  label: string;
  value: number;
  icon: typeof BriefcaseBusiness;
  detail: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-[20px] border border-[#dfe3e6] bg-white p-4 shadow-[0_8px_26px_rgba(23,32,42,0.035)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-xs font-semibold text-[#788188]">{label}</dt>
        <span className={`grid size-8 place-items-center rounded-lg ${alert ? "bg-rose-50 text-rose-700" : "bg-[#f1f3f4] text-[#5e6971]"}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <dd className={`mt-4 text-3xl font-bold tracking-[-0.04em] ${alert ? "text-rose-700" : "text-[#202326]"}`}>{value}</dd>
      <p className="mt-1 text-[11px] text-[#9aa1a6]">{detail}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#d5dadd] bg-white/65 p-6 text-sm leading-6 text-[#7a8389]">
      {text}
    </div>
  );
}
