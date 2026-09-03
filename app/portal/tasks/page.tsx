import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, ClipboardList, Clock3 } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { StaffTaskWorkspace } from "@/components/portal/StaffTaskWorkspace";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import {
  getCurrentPlatformActor,
  listAccessibleClientCases,
} from "@/server/client-cases/operations";
import { getPrismaClient } from "@/server/database/prisma";
import { listTasks } from "@/server/tasks/operations";
import {
  buildStaffTaskPresentationItems,
  buildStaffTaskQueue,
  summarizeStaffTaskQueue,
} from "@/server/tasks/staff-task-view";

export const dynamic = "force-dynamic";

function formatDue(dueAt: Date | null) {
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

export default async function PortalTasksPage() {
  const sessionProvider = createProductionSessionProvider();

  let actor;
  try {
    actor = await getCurrentPlatformActor(sessionProvider);
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) redirect("/auth/sign-in");
    throw error;
  }

  if (!actor.roles.includes("LAWYER") && !actor.roles.includes("MANAGER")) {
    redirect("/portal");
  }

  const [tasks, cases] = await Promise.all([
    listTasks(sessionProvider),
    listAccessibleClientCases(sessionProvider),
  ]);
  const now = new Date();
  const queue = buildStaffTaskQueue(tasks, cases, now);
  const personIds = [
    ...new Set(
      queue.flatMap(({ task, clientCase }) => [task.assigneeId, clientCase.clientId]),
    ),
  ];
  const people = personIds.length
    ? await getPrismaClient().user.findMany({
        where: { id: { in: personIds } },
        select: { id: true, displayName: true },
      })
    : [];
  const presentationItems = buildStaffTaskPresentationItems(queue, people, now);
  const summary = summarizeStaffTaskQueue(queue, now);
  const priorityItem = queue.find(({ task }) => task.status !== "DONE");
  const heading = actor.roles.includes("MANAGER") ? "Рабочая очередь команды" : "Моя рабочая очередь";

  return (
    <PortalFrame sectionLabel="Рабочая очередь" showStaffTasks>
      <main className="py-8 sm:py-10">
        <Link href="/portal" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          В личный кабинет
        </Link>

        <div className="mt-6 flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm">
            <ClipboardList className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="break-words font-[var(--font-iburo-display)] text-4xl font-semibold text-slate-900">{heading}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Сначала показаны просроченные задачи, затем работа в процессе, новые задачи и завершённые. Доступ определяется текущим назначением по делу.
            </p>
          </div>
        </div>

        <section aria-label="Сводка задач" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="Всего" value={summary.total} />
          <Metric label="Новые" value={summary.new} />
          <Metric label="В работе" value={summary.working} />
          <Metric label="Просрочено" value={summary.overdue} alert={summary.overdue > 0} />
          <Metric label="Выполнено" value={summary.done} />
        </section>

        {priorityItem ? (
          <section className="mt-4 rounded-[24px] border border-[#7B2330]/15 bg-[#7B2330]/[0.04] p-4 sm:p-5" aria-labelledby="staff-priority-heading">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7B2330]">Сейчас в приоритете</p>
                <p className="mt-2 inline-flex items-center gap-2 font-mono text-xs font-semibold text-slate-400">
                  <BriefcaseBusiness className="size-3.5" aria-hidden="true" />
                  {priorityItem.clientCase.caseNumber}
                </p>
                <h2 id="staff-priority-heading" className="mt-2 break-words text-xl font-bold text-slate-900">
                  {priorityItem.task.title}
                </h2>
                {priorityItem.task.description ? (
                  <p className="mt-2 break-words text-sm leading-6 text-slate-600">{priorityItem.task.description}</p>
                ) : null}
                {priorityItem.task.dueAt ? (
                  <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    Срок: {formatDue(priorityItem.task.dueAt)}
                  </p>
                ) : null}
              </div>
              <Link
                href={`/portal/cases/${encodeURIComponent(priorityItem.clientCase.id)}/tasks`}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#17202a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#263342]"
              >
                Открыть задачи по делу
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : null}

        <section className="mt-4" aria-label="Рабочая очередь">
          <StaffTaskWorkspace items={presentationItems} />
        </section>
      </main>
    </PortalFrame>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${alert ? "text-[#7B2330]" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
