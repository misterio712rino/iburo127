import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, ArrowLeft, ArrowUpRight, FileLock2, FileText, GraduationCap, ListChecks, ShieldCheck, Sparkles } from "lucide-react";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";

export const dynamic = "force-dynamic";

const MODULES = [
  {
    code: "questionnaire",
    title: "Анкета",
    description: "Серверное хранение ответов, проверка доступа и контроль версий.",
    icon: ListChecks,
  },
  {
    code: "practicum",
    title: "Практикум",
    description: "Прогресс обучения хранится в PostgreSQL и доступен только в рамках дела.",
    icon: GraduationCap,
  },
  {
    code: "documents",
    title: "Документы",
    description: "Подготовка и проверка документов с server-side authorization.",
    icon: FileText,
  },
  {
    code: "files",
    title: "Файлы",
    description: "Приватные READY-файлы без раскрытия object key и внутренних storage-путей.",
    icon: FileLock2,
  },
  {
    code: "activity",
    title: "История",
    description: "Контролируемый журнал действий по делу без чувствительных payload-данных.",
    icon: Activity,
  },
] as const;

const CLIENT_AI_MODULE = {
  code: "ai",
  title: "AI-помощник",
  description: "Информационная поддержка по текущему этапу с серверной проверкой тарифа и доступа.",
  icon: Sparkles,
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

  const modules = actor.roles.includes("CLIENT")
    ? [...MODULES, CLIENT_AI_MODULE]
    : MODULES;

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <IBuroBrand dot className="font-[var(--font-iburo-display)] text-4xl font-semibold tracking-tight" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Защищённое дело</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Доступ подтверждён
          </span>
          <SignOutButton />
        </div>
      </header>

      <main className="py-10 sm:py-14">
        <Link href="/portal" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Все доступные дела
        </Link>

        <section className="mt-8 rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
              <h1 className="mt-3 font-[var(--font-iburo-display)] text-5xl font-semibold leading-none text-slate-900">Дело клиента</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Данные на этой странице получены через серверную сессию и повторную проверку доступа к конкретному ClientCase.</p>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-600">{clientCase.status}</span>
          </div>

          <dl className="mt-8 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <div><dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Тариф</dt><dd className="mt-2 text-lg font-bold text-slate-900">{clientCase.planCode}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Этап</dt><dd className="mt-2 text-lg font-bold text-slate-900">{clientCase.stageCode}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Контроль доступа</dt><dd className="mt-2 text-lg font-bold text-emerald-700">Server-side</dd></div>
          </dl>
        </section>

        <section className="mt-8" aria-labelledby="modules-heading">
          <h2 id="modules-heading" className="text-lg font-bold text-slate-900">Модули дела</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link key={module.code} href={`/portal/cases/${clientCase.id}/${module.code}`} className="rounded-[28px] border border-slate-200 bg-white/80 p-6 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
                  <span className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-700"><Icon className="size-5" aria-hidden="true" /></span>
                  <h3 className="mt-5 text-xl font-bold text-slate-900">{module.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{module.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-700">Открыть серверный модуль<ArrowUpRight className="size-4" aria-hidden="true" /></span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
