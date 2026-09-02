import "server-only";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  House,
  ListTodo,
  UsersRound,
} from "lucide-react";

import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import {
  CASE_STAGE_FLOW,
  getCaseStageDisplayLabel,
} from "@/lib/platform/case-progress";
import { getCaseProgressSummaryForActor } from "@/server/case-progress/operations";
import { getPrismaClient } from "@/server/database/prisma";
import type {
  AuthenticatedActor,
  ClientCaseRecord,
} from "@/server/domain/client-cases/contracts";

const CARD =
  "rounded-[22px] border border-[#dfe3e6] bg-white shadow-[0_16px_45px_rgba(31,43,51,0.045)]";
const PLAN_CODES = ["LITE", "PRO", "INDIVIDUAL"] as const;

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "iБ"
  );
}

function stageProgress(position: number | null, total: number) {
  if (!position || total <= 1) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round(((position - 1) / (total - 1)) * 100)),
  );
}

function planPill(plan: string) {
  return plan === "INDIVIDUAL"
    ? "ИНДИВИДУАЛЬНЫЙ"
    : plan === "PRO"
      ? "ПРО"
      : "ЛАЙТ";
}

function attentionClass(overdue: number, open: number) {
  if (overdue > 0) return "border-[#8f1720]/20 bg-[#8f1720]/8 text-[#8f1720]";
  if (open > 0) return "border-amber-700/20 bg-amber-50 text-amber-800";
  return "border-emerald-700/15 bg-emerald-50 text-emerald-800";
}

function attentionLabel(overdue: number, open: number) {
  if (overdue > 0) return "Высокий приоритет";
  if (open > 0) return "Требует внимания";
  return "В норме";
}

export async function ManagerProductionDashboard({
  actor,
  cases,
}: {
  actor: AuthenticatedActor;
  cases: readonly ClientCaseRecord[];
}) {
  if (!actor.roles.includes("MANAGER")) {
    throw new Error("MANAGER_DASHBOARD_FORBIDDEN");
  }

  const prisma = getPrismaClient();
  const operationalCases = cases.filter(
    (clientCase) =>
      clientCase.status !== "ARCHIVED" && clientCase.status !== "COMPLETED",
  );
  const caseIds = operationalCases.map((clientCase) => clientCase.id);
  const clientIds = [...new Set(operationalCases.map((clientCase) => clientCase.clientId))];
  const now = new Date();

  const [managerUser, clients, staff, tasks, progressEntries] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actor.userId },
      select: { id: true, displayName: true },
    }),
    clientIds.length
      ? prisma.user.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, displayName: true },
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        roles: { some: { role: { code: "LAWYER" } } },
      },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    caseIds.length
      ? prisma.caseTask.findMany({
          where: { clientCaseId: { in: caseIds } },
          select: {
            id: true,
            clientCaseId: true,
            assigneeId: true,
            status: true,
            dueAt: true,
          },
        })
      : Promise.resolve([]),
    Promise.all(
      operationalCases.map(
        async (clientCase) =>
          [
            clientCase.id,
            await getCaseProgressSummaryForActor(actor, clientCase, "STAFF"),
          ] as const,
      ),
    ),
  ]);

  const progressByCase = new Map(progressEntries);
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const staffById = new Map(staff.map((employee) => [employee.id, employee]));
  const tasksByCase = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const bucket = tasksByCase.get(task.clientCaseId) ?? [];
    bucket.push(task);
    tasksByCase.set(task.clientCaseId, bucket);
  }

  const openTasks = tasks.filter((task) => task.status !== "DONE");
  const overdueTasks = openTasks.filter((task) => task.dueAt && task.dueAt < now);
  const workingTasks = tasks.filter((task) => task.status === "WORKING");
  const attentionCases = operationalCases.filter((clientCase) =>
    (tasksByCase.get(clientCase.id) ?? []).some((task) => task.status !== "DONE"),
  );
  const managerName = managerUser?.displayName?.trim() || "Руководитель практики";

  const stageRows = CASE_STAGE_FLOW.map((stage) => ({
    code: stage.code,
    label: stage.label,
    count: operationalCases.filter((clientCase) => clientCase.stageCode === stage.code)
      .length,
  })).filter((row) => row.count > 0);

  return (
    <div className="min-h-screen bg-[#f3f5f6] text-[#202326]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-[#202b33] px-5 py-6 text-white lg:flex">
        <Link
          href="/portal"
          className="mb-10 inline-flex text-2xl font-semibold tracking-[-0.05em]"
        >
          <IBuroBrand dot />
        </Link>
        <nav className="grid gap-1 text-sm" aria-label="Навигация руководителя">
          <ManagerNavLink href="/portal" label="Рабочий стол" icon={House} active />
          <ManagerNavLink href="#clients" label="Клиенты" icon={UsersRound} />
          <ManagerNavLink href="#team" label="Команда" icon={UsersRound} />
          <ManagerNavLink href="#clients" label="Дела" icon={BriefcaseBusiness} />
          <ManagerNavLink href="/portal/tasks" label="Задачи" icon={ListTodo} />
          <ManagerNavLink
            href="/portal/leads"
            label="Потенциальные клиенты"
            icon={Activity}
          />
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 p-4">
          <p className="text-xs font-semibold">{managerName}</p>
          <p className="mt-1 text-xs text-white/55">Руководитель практики</p>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-4 border-b border-[#dfe3e6] bg-[#f3f5f6]/95 px-5 backdrop-blur sm:px-8 lg:px-10">
          <p className="text-xs text-[#7b858d] sm:text-sm">Платформа сопровождения</p>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-full border border-[#dfe3e6] bg-white py-1.5 pl-1.5 pr-3 sm:flex">
              <span className="grid size-8 place-items-center rounded-full bg-[#8f1720] text-[10px] font-bold text-white">
                {initials(managerName)}
              </span>
              <div className="leading-tight">
                <p className="text-xs font-semibold">{managerName}</p>
                <p className="text-[10px] text-[#7b858d]">Руководитель практики</p>
              </div>
            </div>
            <SignOutButton />
          </div>
        </header>

        <main className="mx-auto max-w-[1220px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <section>
            <h1 className="font-[var(--font-iburo-display)] text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Панель руководителя
            </h1>
            <p className="mt-2 text-sm text-[#7b858d]">Операционная картина практики</p>
          </section>

          <section
            className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7"
            aria-label="Ключевые показатели"
          >
            <Metric label="Активные клиенты" value={operationalCases.length} />
            {PLAN_CODES.map((plan) => (
              <Metric
                key={plan}
                label={plan}
                value={operationalCases.filter((item) => item.planCode === plan).length}
              />
            ))}
            <Metric label="Сотрудники" value={staff.length} />
            <Metric label="Требуют внимания" value={attentionCases.length} />
            <Metric label="Просроченные задачи" value={overdueTasks.length} />
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
            <div className={`${CARD} p-5 sm:p-6`}>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                Распределение по этапам
              </h2>
              <div className="mt-6 grid gap-4">
                {stageRows.length ? (
                  stageRows.map((row) => (
                    <div key={row.code}>
                      <div className="mb-2 flex justify-between gap-4 text-sm">
                        <span>{row.label}</span>
                        <strong>{row.count}</strong>
                      </div>
                      <Progress
                        value={
                          operationalCases.length
                            ? Math.round((row.count / operationalCases.length) * 100)
                            : 0
                        }
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#7b858d]">Активных дел пока нет.</p>
                )}
              </div>
            </div>
            <div className={`${CARD} p-5 sm:p-6`}>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">Операционный фокус</h2>
              <div className="mt-5 grid gap-3">
                <Summary label="Открытые задачи" value={openTasks.length} icon={ClipboardCheck} />
                <Summary label="Просроченные" value={overdueTasks.length} icon={AlertTriangle} />
                <Summary label="В работе" value={workingTasks.length} icon={CheckCircle2} />
              </div>
              <Link
                href="/portal/tasks"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#8f1720]"
              >
                Открыть общую очередь
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </section>

          <section id="team" className="mt-9 scroll-mt-28">
            <div className="mb-5">
              <h2 className="text-3xl font-semibold tracking-[-0.035em]">Команда</h2>
              <p className="mt-2 text-sm text-[#7b858d]">
                Назначенные дела и фактическая очередь задач сотрудников
              </p>
            </div>
            {staff.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {staff.map((employee) => {
                  const employeeCases = operationalCases.filter(
                    (item) => item.assignedLawyerId === employee.id,
                  );
                  const employeeTasks = openTasks.filter(
                    (task) => task.assigneeId === employee.id,
                  );
                  const urgent = employeeTasks.filter(
                    (task) => task.dueAt && task.dueAt < now,
                  );
                  const name = employee.displayName?.trim() || "Юрист";
                  return (
                    <div key={employee.id} className={`${CARD} p-5 sm:p-6`}>
                      <div className="flex items-center gap-4">
                        <span className="grid size-11 place-items-center rounded-full bg-[#a5121b] text-xs font-bold text-white">
                          {initials(name)}
                        </span>
                        <div>
                          <h3 className="text-lg font-semibold">{name}</h3>
                          <p className="mt-1 text-xs text-[#7b858d]">Юрист</p>
                        </div>
                      </div>
                      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                        <Mini label="Дела" value={employeeCases.length} />
                        <Mini label="Открытые задачи" value={employeeTasks.length} />
                        <Mini label="Просрочено" value={urgent.length} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`${CARD} p-6 text-sm text-[#7b858d]`}>
                Активные сотрудники с ролью юриста пока не найдены.
              </div>
            )}
          </section>

          <section id="clients" className="mt-10 scroll-mt-28 pb-12">
            <div className="mb-5">
              <h2 className="text-3xl font-semibold tracking-[-0.035em]">Клиенты</h2>
              <p className="mt-2 text-sm text-[#7b858d]">
                Портфель по тарифам и текущим этапам
              </p>
            </div>
            <div className="grid gap-7">
              {PLAN_CODES.map((plan) => {
                const planCases = operationalCases.filter((item) => item.planCode === plan);
                if (!planCases.length) return null;
                return (
                  <div key={plan}>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="rounded-full border border-[#8f1720]/20 bg-[#8f1720]/8 px-3 py-1 text-[10px] font-bold tracking-[0.09em] text-[#8f1720]">
                        {planPill(plan)}
                      </span>
                      <span className="text-sm text-[#7b858d]">{planCases.length}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {planCases.map((clientCase) => {
                        const clientName =
                          clientById.get(clientCase.clientId)?.displayName?.trim() || "Клиент";
                        const lawyerName = clientCase.assignedLawyerId
                          ? staffById.get(clientCase.assignedLawyerId)?.displayName?.trim()
                          : null;
                        const caseTasks = tasksByCase.get(clientCase.id) ?? [];
                        const caseOpen = caseTasks.filter((task) => task.status !== "DONE");
                        const caseOverdue = caseOpen.filter(
                          (task) => task.dueAt && task.dueAt < now,
                        );
                        const progress = progressByCase.get(clientCase.id);
                        const routeProgress = stageProgress(
                          progress?.stage.position ?? null,
                          progress?.stage.total ?? CASE_STAGE_FLOW.length,
                        );
                        return (
                          <Link
                            href={`/portal/cases/${clientCase.id}`}
                            key={clientCase.id}
                            className={`${CARD} block p-5 transition hover:-translate-y-0.5 hover:border-[#8f1720]/30`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="grid size-9 place-items-center rounded-full bg-[#a5121b] text-[10px] font-bold text-white">
                                {initials(clientName)}
                              </span>
                              <span className="rounded-full border border-[#8f1720]/20 bg-[#8f1720]/6 px-2.5 py-1 text-[9px] font-bold text-[#8f1720]">
                                {planPill(plan)}
                              </span>
                            </div>
                            <h3 className="mt-5 text-base font-semibold">{clientName}</h3>
                            <p className="mt-1 font-mono text-[10px] text-[#8a949b]">
                              {clientCase.caseNumber}
                            </p>
                            <p className="mt-4 text-sm font-medium">
                              {getCaseStageDisplayLabel(clientCase.stageCode, "STAFF")}
                            </p>
                            <div className="mt-3">
                              <Progress value={routeProgress} />
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] text-[#7b858d]">
                                {lawyerName || "Юрист не назначен"}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.05em] ${attentionClass(caseOverdue.length, caseOpen.length)}`}
                              >
                                {attentionLabel(caseOverdue.length, caseOpen.length)}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function ManagerNavLink({
  href,
  label,
  icon: Icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: typeof House;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex h-11 items-center gap-3 rounded-xl px-3 transition ${
        active
          ? "bg-white/10 text-white"
          : "text-white/78 hover:bg-white/8 hover:text-white"
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${CARD} min-h-[98px] p-4`}>
      <p className="text-[11px] leading-4 text-[#7b858d]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{value}</p>
    </div>
  );
}

function Summary({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#f1f3f4] px-4 py-3">
      <span className="inline-flex items-center gap-2 text-sm text-[#7b858d]">
        <Icon className="size-4 text-[#8f1720]" aria-hidden="true" />
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#f1f3f4] p-3">
      <strong className="text-lg">{value}</strong>
      <span className="mt-1 block text-[10px] text-[#7b858d]">{label}</span>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-[#e5e8ea]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div
        className="h-full rounded-full bg-[#9b1720]"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
