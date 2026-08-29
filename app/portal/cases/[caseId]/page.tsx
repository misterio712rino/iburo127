import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, ArrowLeft, ArrowUpRight, ClipboardList, FileLock2, FileText, Gauge, GraduationCap, ListChecks, Sparkles } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { getCaseStageLabel, getCaseStatusLabel, getPlanLabel } from "@/lib/platform/case-progress";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";

export const dynamic = "force-dynamic";

const MODULES = [
  { code: "progress", title: "Прогресс", description: "Текущий этап и готовность основных материалов дела в одном месте.", icon: Gauge },
  { code: "questionnaire", title: "Анкета", description: "Сведения, необходимые для анализа ситуации и подготовки материалов дела.", icon: ListChecks },
  { code: "practicum", title: "Практикум", description: "Обучающие материалы и ваш прогресс по программе сопровождения.", icon: GraduationCap },
  { code: "documents", title: "Документы", description: "Подготовка документов и их передача на проверку юристу.", icon: FileText },
  { code: "files", title: "Файлы", description: "Безопасное хранение и скачивание проверенных файлов по делу.", icon: FileLock2 },
  { code: "activity", title: "История", description: "Хронология подтверждённых действий и изменений по делу.", icon: Activity },
] as const;

const CLIENT_AI_MODULE = {
  code: "ai",
  title: "AI-помощник",
  description: "Информационная помощь по материалам и текущему этапу вашего дела.",
  icon: Sparkles,
} as const;

const STAFF_TASK_MODULE = {
  code: "tasks",
  title: "Задачи",
  description: "Рабочая очередь задач, относящихся к этому делу.",
  icon: ClipboardList,
} as const;

export default async function PortalCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const sessionProvider = createProductionSessionProvider();

  let actor;
  try {
    actor = await getCurrentPlatformActor(sessionProvider);
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) redirect("/auth/sign-in");
    throw error;
  }

  const clientCase = await clientCaseService.getCase(actor, { caseId });
  if (!clientCase) notFound();

  const isStaff = actor.roles.includes("LAWYER") || actor.roles.includes("MANAGER");
  const isClient = actor.roles.includes("CLIENT");
  const modules = isClient
    ? [...MODULES, CLIENT_AI_MODULE]
    : isStaff
      ? [...MODULES, STAFF_TASK_MODULE]
      : MODULES;

  return (
    <PortalFrame sectionLabel={`Дело ${clientCase.caseNumber}`} accessLabel="Доступ открыт" showStaffTasks={isStaff}>
      <main className="py-10 sm:py-14">
        <Link href="/portal" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Все дела
        </Link>

        <section className="mt-8 rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
              <h1 className="mt-3 font-[var(--font-iburo-display)] text-5xl font-semibold leading-none text-slate-900">{isClient ? "Ваше дело" : "Дело клиента"}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Здесь собраны основные материалы, этапы и действия по этому делу.</p>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">{getCaseStatusLabel(clientCase.status)}</span>
          </div>

          <dl className="mt-8 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <div><dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Тариф</dt><dd className="mt-2 text-lg font-bold text-slate-900">{getPlanLabel(clientCase.planCode)}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Текущий этап</dt><dd className="mt-2 text-lg font-bold text-slate-900">{getCaseStageLabel(clientCase.stageCode)}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Доступ</dt><dd className="mt-2 text-lg font-bold text-emerald-700">Подтверждён</dd></div>
          </dl>
        </section>

        <section className="mt-8" aria-labelledby="modules-heading">
          <h2 id="modules-heading" className="text-lg font-bold text-slate-900">Разделы дела</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link key={module.code} href={`/portal/cases/${clientCase.id}/${module.code}`} className="rounded-[28px] border border-slate-200 bg-white/80 p-6 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
                  <span className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-700"><Icon className="size-5" aria-hidden="true" /></span>
                  <h3 className="mt-5 text-xl font-bold text-slate-900">{module.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{module.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-700">Открыть<ArrowUpRight className="size-4" aria-hidden="true" /></span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </PortalFrame>
  );
}
