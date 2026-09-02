import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Flag,
  Gauge,
  GraduationCap,
  ListChecks,
} from "lucide-react";
import { CasePortalFrame } from "@/components/portal/CasePortalFrame";
import { PlatformCard, ProgressBar } from "@/components/platform/PlatformPrimitives";
import { buttonVariants } from "@/components/ui/button";
import { CASE_STAGE_FLOW } from "@/lib/platform/case-progress";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import { cn } from "@/lib/utils";
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

  const audience = resolveCasePortalAudience(actor, clientCase);
  const isStaff = audience === "STAFF";
  const summary = await getCaseProgressSummaryForActor(actor, clientCase, audience);
  const caseHref = `/portal/cases/${clientCase.id}`;
  const nextHref = `${caseHref}/${summary.nextAction.segment}`;

  return (
    <CasePortalFrame sessionProvider={sessionProvider} actor={actor} clientCase={clientCase} sectionLabel="Прогресс дела" showStaffTasks={isStaff}>
      {audience === "CLIENT" ? (
        <ClientProgressView caseHref={caseHref} summary={summary} />
      ) : (
        <StaffProgressView caseHref={caseHref} nextHref={nextHref} caseNumber={clientCase.caseNumber} summary={summary} />
      )}
    </CasePortalFrame>
  );
}

function ClientProgressView({
  caseHref,
  summary,
}: {
  caseHref: string;
  summary: Awaited<ReturnType<typeof getCaseProgressSummaryForActor>>;
}) {
  const currentIndex = summary.stage.position ? summary.stage.position - 1 : -1;
  const nextStage = currentIndex >= 0
    ? CASE_STAGE_FLOW[currentIndex + 1]?.label ?? "Завершено"
    : "Уточняется";
  const routePercent = summary.stage.position && summary.stage.total > 1
    ? Math.round(((summary.stage.position - 1) / (summary.stage.total - 1)) * 100)
    : 0;
  const documentsReady = summary.documents.readyForReview + summary.documents.sentForReview + summary.documents.reviewed;
  const documentPercent = summary.documents.total > 0
    ? Math.round((documentsReady / summary.documents.total) * 100)
    : 0;
  const nextHref = `${caseHref}/${summary.nextAction.segment}`;

  return (
    <div className="flex min-w-0 flex-col gap-7 py-1 sm:gap-9 sm:py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Ваше дело</p>
          <h1 className="mt-2 font-[var(--font-iburo-display)] text-3xl font-semibold tracking-[-.04em] text-foreground sm:text-5xl">Мой прогресс</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Полная картина движения дела по этапам и готовности материалов.</p>
        </div>
        <Link href={caseHref} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 rounded-full px-5 py-3")}>На главную</Link>
      </div>

      <PlatformCard className="relative overflow-hidden border-primary/25 p-6 sm:p-8">
        <Flag className="absolute -bottom-10 -right-8 size-48 text-primary opacity-[.06]" aria-hidden="true" />
        <div className="relative grid gap-7 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Текущий этап</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{summary.stage.label}</h2>
            <p className="mt-3 text-sm text-muted-foreground">Следующий этап: {nextStage}</p>
          </div>
          <div>
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Маршрут дела</span>
                <p className="mt-1 text-xs text-muted-foreground">{summary.stage.position ? `Этап ${summary.stage.position} из ${summary.stage.total}` : "Этап уточняется"}</p>
              </div>
              <strong className="text-4xl tracking-[-.05em]">{routePercent}%</strong>
            </div>
            <ProgressBar value={routePercent} />
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Индикатор показывает положение в маршруте этапов и не является прогнозом срока завершения процедуры.</p>
          </div>
        </div>
      </PlatformCard>

      <section aria-labelledby="procedure-progress-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Процедура</p>
            <h2 id="procedure-progress-title" className="mt-2 text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Этапы дела</h2>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">Актуально по данным дела</p>
        </div>
        <div className="mt-5 overflow-x-auto pb-2" aria-label="Этапы дела">
          <ol className="flex min-w-[760px] items-start gap-2">
            {CASE_STAGE_FLOW.map((stage, index) => {
              const current = summary.stage.position === index + 1;
              const completed = summary.stage.position !== null && index + 1 < summary.stage.position;
              return (
                <li key={stage.code} className="min-w-0 flex-1">
                  <div className={`h-1.5 rounded-full ${current ? "bg-primary" : completed ? "bg-emerald-500" : "bg-muted"}`} aria-hidden="true" />
                  <p className={`mt-2 text-[10px] font-semibold leading-4 ${current ? "text-primary" : completed ? "text-emerald-700" : "text-muted-foreground"}`}>{stage.label}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Готовность материалов дела">
        <ClientProgressMetric
          icon={BookOpen}
          title="Практикум"
          value={`${summary.practicum.completed} из ${summary.practicum.total}`}
          progress={summary.practicum.percent}
          detail={summary.practicum.status === "COMPLETED" ? "Обучение завершено" : STATUS_LABELS[summary.practicum.status]}
          href={`${caseHref}/practicum`}
        />
        <ClientProgressMetric
          icon={ClipboardCheck}
          title="Анкета"
          value={`${summary.questionnaire.completed} из ${summary.questionnaire.total}`}
          progress={summary.questionnaire.percent}
          detail={summary.questionnaire.status === "COMPLETED" ? "Анкета заполнена" : STATUS_LABELS[summary.questionnaire.status]}
          href={`${caseHref}/questionnaire`}
        />
        <ClientProgressMetric
          icon={FileText}
          title="Документы"
          value={`${documentsReady} готово`}
          progress={documentPercent}
          detail={summary.documents.sentForReview > 0 ? `${summary.documents.sentForReview} на проверке` : summary.documents.reviewed > 0 ? `${summary.documents.reviewed} проверено специалистом` : "Готовность комплекта"}
          href={`${caseHref}/documents`}
        />
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <PlatformCard className="p-5 sm:p-6">
          <h2 className="text-2xl font-semibold">Ближайшее действие</h2>
          <div className="mt-5 flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><ArrowRight className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="font-semibold">{summary.nextAction.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{summary.nextAction.description}</p>
              <Link href={nextHref} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-primary">Перейти<ArrowRight className="size-4" aria-hidden="true" /></Link>
            </div>
          </div>
        </PlatformCard>

        <PlatformCard className="p-5 sm:p-6">
          <h2 className="text-2xl font-semibold">Материалы дела</h2>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Проверенные документы</span><strong>{summary.documents.reviewed}</strong></div>
            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">На проверке у специалиста</span><strong>{summary.documents.sentForReview}</strong></div>
            <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Безопасные файлы</span><strong>{summary.readyFileCount}</strong></div>
          </div>
          <Link href={`${caseHref}/files`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-primary">Открыть файлы<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </PlatformCard>
      </section>
    </div>
  );
}

function ClientProgressMetric({
  icon: Icon,
  title,
  value,
  progress,
  detail,
  href,
}: {
  icon: typeof BookOpen;
  title: string;
  value: string;
  progress: number;
  detail: string;
  href: string;
}) {
  return (
    <PlatformCard className="flex min-w-0 flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-muted text-primary"><Icon className="size-5" aria-hidden="true" /></span><span className="font-semibold">{value}</span></div>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{detail}</p>
      <div className="mt-5"><ProgressBar value={progress} /></div>
      <Link href={href} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Открыть<ArrowRight className="size-4" aria-hidden="true" /></Link>
    </PlatformCard>
  );
}

function StaffProgressView({
  caseHref,
  nextHref,
  caseNumber,
  summary,
}: {
  caseHref: string;
  nextHref: string;
  caseNumber: string;
  summary: Awaited<ReturnType<typeof getCaseProgressSummaryForActor>>;
}) {
  return (
    <div className="py-10 sm:py-14">
      <Link href={caseHref} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"><ArrowLeft className="size-4" aria-hidden="true" />Назад к делу {caseNumber}</Link>

      <section className="mt-6 rounded-[32px] border border-white/80 bg-white/80 p-6 shadow-[0_18px_55px_rgba(75,57,43,0.07)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl"><span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"><Gauge className="size-4" aria-hidden="true" />Состояние дела</span><p className="mt-3 font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{caseNumber}</p><h1 className="mt-2 font-[var(--font-iburo-display)] text-3xl font-semibold leading-none text-slate-900 sm:text-5xl">Прогресс дела</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Здесь собраны текущий этап дела, готовность анкеты, практикума, документов и доступных файлов. Это не прогноз срока завершения процедуры банкротства.</p></div>
          <div className="rounded-2xl bg-slate-50 px-5 py-4 lg:text-right"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Текущий этап</p><p className="mt-2 text-xl font-bold text-slate-900">{summary.stage.label}</p><p className="mt-1 text-xs font-semibold text-slate-500">{summary.stage.position ? `Этап ${summary.stage.position} из ${summary.stage.total}` : summary.stage.code}</p></div>
        </div>
        <div className="mt-8 overflow-x-auto pb-2" aria-label="Этапы дела"><ol className="flex min-w-[760px] items-start gap-2">{CASE_STAGE_FLOW.map((stage, index) => { const current = summary.stage.position === index + 1; const completed = summary.stage.position !== null && index + 1 < summary.stage.position; return <li key={stage.code} className="min-w-0 flex-1"><div className={`h-1.5 rounded-full ${current ? "bg-[#7B2330]" : completed ? "bg-emerald-500" : "bg-slate-200"}`} aria-hidden="true" /><p className={`mt-2 text-[10px] font-semibold leading-4 ${current ? "text-[#7B2330]" : completed ? "text-emerald-700" : "text-slate-400"}`}>{stage.label}</p></li>; })}</ol></div>
      </section>

      <section className="mt-6 rounded-[28px] border border-[#7B2330]/15 bg-[#7B2330]/[0.04] p-6 sm:p-7" aria-labelledby="next-action-heading"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7B2330]">Следующий шаг</p><div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><h2 id="next-action-heading" className="text-2xl font-bold text-slate-900">{summary.nextAction.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{summary.nextAction.description}</p></div><Link href={nextHref} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#17202a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#263342]">Перейти <ArrowRight className="size-4" aria-hidden="true" /></Link></div></section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Готовность материалов дела">
        <ProgressCard icon={ListChecks} title="Анкета" status={STATUS_LABELS[summary.questionnaire.status]} detail={`${summary.questionnaire.completed} из ${summary.questionnaire.total} разделов`} percent={summary.questionnaire.percent} href={`${caseHref}/questionnaire`} />
        <ProgressCard icon={GraduationCap} title="Практикум" status={STATUS_LABELS[summary.practicum.status]} detail={`${summary.practicum.completed} из ${summary.practicum.total} уроков`} percent={summary.practicum.percent} href={`${caseHref}/practicum`} />
        <MetricCard icon={FileText} title="Документы" primary={`${summary.documents.reviewed} проверено`} detail={summary.documents.total ? `${summary.documents.total} всего · ${summary.documents.sentForReview} на проверке` : "Документы ещё не сформированы"} href={`${caseHref}/documents`} />
        <MetricCard icon={FileCheck2} title="Проверенные файлы" primary={`${summary.readyFileCount} шт.`} detail="Показываются только файлы, прошедшие проверку безопасности." href={`${caseHref}/files`} />
      </section>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/65 px-4 py-4 text-xs leading-5 text-slate-500"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />Этап и готовность материалов рассчитываются автоматически по актуальным данным вашего дела.</div>
    </div>
  );
}

function ProgressCard({ icon: Icon, title, status, detail, percent, href }: { icon: typeof ListChecks; title: string; status: string; detail: string; percent: number; href: string }) {
  return <Link href={href} className="rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-slate-300"><div className="flex items-center justify-between gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700"><Icon className="size-5" aria-hidden="true" /></span><span className="text-2xl font-bold text-slate-900">{percent}%</span></div><h2 className="mt-5 text-lg font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm font-semibold text-slate-600">{status}</p><p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-[#7B2330]" style={{ width: `${percent}%` }} /></div></Link>;
}

function MetricCard({ icon: Icon, title, primary, detail, href }: { icon: typeof FileText; title: string; primary: string; detail: string; href: string }) {
  return <Link href={href} className="rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-slate-300"><span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700"><Icon className="size-5" aria-hidden="true" /></span><h2 className="mt-5 text-lg font-bold text-slate-900">{title}</h2><p className="mt-2 text-2xl font-bold text-slate-900">{primary}</p><p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p></Link>;
}
