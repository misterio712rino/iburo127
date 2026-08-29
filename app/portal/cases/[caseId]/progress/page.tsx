import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  Gauge,
  GraduationCap,
  ListChecks,
} from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { CASE_STAGE_FLOW } from "@/lib/platform/case-progress";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCaseProgressSummaryForActor } from "@/server/case-progress/operations";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  NOT_STARTED: "Не начато",
  IN_PROGRESS: "В процессе",
  COMPLETED: "Завершено",
} as const;

export default async function PortalCaseProgressPage({ params }: { params: Promise<{ caseId: string }> }) {
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
  const summary = await getCaseProgressSummaryForActor(
    actor,
    clientCase,
    isStaff ? "STAFF" : "CLIENT",
  );

  const caseHref = `/portal/cases/${clientCase.id}`;
  const nextHref = `${caseHref}/${summary.nextAction.segment}`;

  return (
    <PortalFrame sectionLabel="Прогресс дела" accessLabel="Доступ подтверждён" showStaffTasks={isStaff}>
      <main className="py-10 sm:py-14">
        <Link href={caseHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Назад к делу {clientCase.caseNumber}
        </Link>

        <section className="mt-8 rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><Gauge className="size-4" aria-hidden="true" />Состояние дела</span>
              <p className="mt-3 font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
              <h1 className="mt-2 font-[var(--font-iburo-display)] text-4xl font-semibold leading-none text-slate-900 sm:text-5xl">Прогресс дела</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">
                Здесь собраны текущий этап дела, готовность анкеты, практикума, документов и доступных файлов. Это не прогноз срока завершения процедуры банкротства.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4 lg:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Текущий этап</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{summary.stage.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {summary.stage.position ? `Этап ${summary.stage.position} из ${summary.stage.total}` : isStaff ? summary.stage.code : "Этап уточняется"}
              </p>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto pb-2" aria-label="Этапы дела">
            <ol className="flex min-w-[760px] items-start gap-2">
              {CASE_STAGE_FLOW.map((stage, index) => {
                const current = summary.stage.position === index + 1;
                const completed = summary.stage.position !== null && index + 1 < summary.stage.position;
                return (
                  <li key={stage.code} className="min-w-0 flex-1">
                    <div className={`h-1.5 rounded-full ${current ? "bg-[#7B2330]" : completed ? "bg-emerald-500" : "bg-slate-200"}`} aria-hidden="true" />
                    <p className={`mt-2 text-[10px] font-semibold leading-4 ${current ? "text-[#7B2330]" : completed ? "text-emerald-700" : "text-slate-400"}`}>{stage.label}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-[#7B2330]/15 bg-[#7B2330]/[0.04] p-6 sm:p-7" aria-labelledby="next-action-heading">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7B2330]">Следующий шаг</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="next-action-heading" className="text-2xl font-bold text-slate-900">{summary.nextAction.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{summary.nextAction.description}</p>
            </div>
            <Link href={nextHref} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#17202a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#263342]">
              Перейти <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Готовность материалов дела">
          <ProgressCard
            icon={ListChecks}
            title="Анкета"
            status={STATUS_LABELS[summary.questionnaire.status]}
            detail={`${summary.questionnaire.completed} из ${summary.questionnaire.total} разделов`}
            percent={summary.questionnaire.percent}
            href={`${caseHref}/questionnaire`}
          />
          <ProgressCard
            icon={GraduationCap}
            title="Практикум"
            status={STATUS_LABELS[summary.practicum.status]}
            detail={`${summary.practicum.completed} из ${summary.practicum.total} уроков`}
            percent={summary.practicum.percent}
            href={`${caseHref}/practicum`}
          />
          <MetricCard
            icon={FileText}
            title="Документы"
            primary={`${summary.documents.reviewed} проверено`}
            detail={summary.documents.total ? `${summary.documents.total} всего · ${summary.documents.sentForReview} на проверке` : "Документы ещё не сформированы"}
            href={`${caseHref}/documents`}
          />
          <MetricCard
            icon={FileCheck2}
            title="Проверенные файлы"
            primary={`${summary.readyFileCount} шт.`}
            detail="Показываются только файлы, прошедшие проверку безопасности."
            href={`${caseHref}/files`}
          />
        </section>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/65 px-4 py-4 text-xs leading-5 text-slate-500">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
          Этап и готовность материалов рассчитываются автоматически по актуальным данным вашего дела.
        </div>
      </main>
    </PortalFrame>
  );
}

function ProgressCard({
  icon: Icon,
  title,
  status,
  detail,
  percent,
  href,
}: {
  icon: typeof ListChecks;
  title: string;
  status: string;
  detail: string;
  percent: number;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-slate-300">
      <div className="flex items-center justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700"><Icon className="size-5" aria-hidden="true" /></span>
        <span className="text-2xl font-bold text-slate-900">{percent}%</span>
      </div>
      <h2 className="mt-5 text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm font-semibold text-slate-600">{status}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-[#7B2330]" style={{ width: `${percent}%` }} /></div>
    </Link>
  );
}

function MetricCard({
  icon: Icon,
  title,
  primary,
  detail,
  href,
}: {
  icon: typeof FileText;
  title: string;
  primary: string;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-slate-300">
      <span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700"><Icon className="size-5" aria-hidden="true" /></span>
      <h2 className="mt-5 text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-2 text-2xl font-bold text-slate-900">{primary}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </Link>
  );
}
