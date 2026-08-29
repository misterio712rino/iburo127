import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { StaffTaskList } from "@/components/portal/StaffTaskList";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { listTasks } from "@/server/tasks/operations";
import { buildStaffTaskQueue, summarizeStaffTaskQueue } from "@/server/tasks/staff-task-view";

export const dynamic = "force-dynamic";

export default async function PortalCaseTasksPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const sessionProvider = createProductionSessionProvider();

  let actor;
  try {
    actor = await getCurrentPlatformActor(sessionProvider);
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) redirect("/auth/sign-in");
    throw error;
  }

  const isStaff = actor.roles.includes("LAWYER") || actor.roles.includes("MANAGER");
  if (!isStaff) redirect(`/portal/cases/${encodeURIComponent(caseId)}`);

  const clientCase = await clientCaseService.getCase(actor, { caseId });
  if (!clientCase) notFound();

  const tasks = await listTasks(sessionProvider);
  const queue = buildStaffTaskQueue(tasks, [clientCase]);
  const summary = summarizeStaffTaskQueue(queue);
  const caseHref = `/portal/cases/${encodeURIComponent(clientCase.id)}`;

  return (
    <PortalFrame sectionLabel={`Задачи · ${clientCase.caseNumber}`} accessLabel="Staff access" showStaffTasks>
      <main className="py-10 sm:py-14">
        <Link href={caseHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          В дело {clientCase.caseNumber}
        </Link>

        <section className="mt-8 rounded-[30px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.07)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                <ClipboardList className="size-4" aria-hidden="true" /> Операционная работа
              </span>
              <h1 className="mt-3 font-[var(--font-iburo-display)] text-4xl font-semibold text-slate-900 sm:text-5xl">
                Задачи по делу
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Здесь отображаются только задачи, одновременно разрешённые staff-политикой и принадлежащие этому доступному ClientCase.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniMetric label="Новые" value={summary.new} />
              <MiniMetric label="В работе" value={summary.working} />
              <MiniMetric label="Просрочено" value={summary.overdue} alert={summary.overdue > 0} />
            </div>
          </div>
        </section>

        <section className="mt-6" aria-label={`Задачи по делу ${clientCase.caseNumber}`}>
          <StaffTaskList items={queue} emptyMessage="По этому делу доступных задач сейчас нет." />
        </section>
      </main>
    </PortalFrame>
  );
}

function MiniMetric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="min-w-20 rounded-2xl bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${alert ? "text-[#7B2330]" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
