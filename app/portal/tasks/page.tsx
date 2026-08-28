import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, Clock3 } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { TaskStatusControl } from "@/components/platform/tasks/TaskStatusControl";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { listTasks } from "@/server/tasks/operations";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  NEW: "Новая",
  WORKING: "В работе",
  DONE: "Выполнена",
} as const;

export default async function PortalTasksPage() {
  const sessionProvider = createProductionSessionProvider();

  let actor;
  let tasks;
  try {
    actor = await getCurrentPlatformActor(sessionProvider);
    tasks = await listTasks(sessionProvider);
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) redirect("/auth/sign-in");
    throw error;
  }

  if (!actor.roles.includes("LAWYER") && !actor.roles.includes("MANAGER")) {
    redirect("/portal");
  }

  return (
    <PortalFrame sectionLabel="Задачи сотрудников" showStaffTasks>
      <main className="py-10">
        <Link href="/portal" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          В защищённый кабинет
        </Link>

        <div className="mt-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm"><ClipboardList className="size-5" aria-hidden="true" /></span>
          <div>
            <h1 className="font-[var(--font-iburo-display)] text-4xl font-semibold text-slate-900">Задачи</h1>
            <p className="mt-1 text-sm text-slate-500">Менеджер видит доступные staff-задачи, юрист — только назначенные ему.</p>
          </div>
        </div>

        {tasks.length ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {tasks.map((task) => (
              <article key={task.id} className="rounded-[26px] border border-white/80 bg-white/90 p-6 shadow-[0_14px_45px_rgba(15,23,42,0.07)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{task.title}</p>
                    {task.description ? <p className="mt-2 text-sm leading-6 text-slate-500">{task.description}</p> : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">{STATUS_LABELS[task.status]}</span>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs text-slate-400">
                  <span>Версия {task.version}</span>
                  {task.dueAt ? (
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />До {task.dueAt.toLocaleString("ru-RU")}</span>
                  ) : null}
                </div>
                <TaskStatusControl taskId={task.id} status={task.status} version={task.version} />
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm text-slate-500">Доступных задач сейчас нет.</div>
        )}
      </main>
    </PortalFrame>
  );
}
