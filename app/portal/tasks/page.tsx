import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { StaffTaskList } from "@/components/portal/StaffTaskList";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import {
  getCurrentPlatformActor,
  listAccessibleClientCases,
} from "@/server/client-cases/operations";
import { listTasks } from "@/server/tasks/operations";
import { buildStaffTaskQueue, summarizeStaffTaskQueue } from "@/server/tasks/staff-task-view";

export const dynamic = "force-dynamic";

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
  const queue = buildStaffTaskQueue(tasks, cases);
  const summary = summarizeStaffTaskQueue(queue);

  return (
    <PortalFrame sectionLabel="Задачи сотрудников" showStaffTasks>
      <main className="py-10">
        <Link href="/portal" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          В защищённый кабинет
        </Link>

        <div className="mt-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm">
            <ClipboardList className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-[var(--font-iburo-display)] text-4xl font-semibold text-slate-900">Рабочая очередь</h1>
            <p className="mt-1 text-sm text-slate-500">
              Юрист видит задачи только по назначенным ему делам, менеджер — по доступному staff-контуру.
            </p>
          </div>
        </div>

        <section aria-label="Сводка задач" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="Всего" value={summary.total} />
          <Metric label="Новые" value={summary.new} />
          <Metric label="В работе" value={summary.working} />
          <Metric label="Просрочено" value={summary.overdue} alert={summary.overdue > 0} />
          <Metric label="Выполнено" value={summary.done} />
        </section>

        <section className="mt-6" aria-label="Задачи сотрудников">
          <StaffTaskList items={queue} />
        </section>
      </main>
    </PortalFrame>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${alert ? "text-[#7B2330]" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
