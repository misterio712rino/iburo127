import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Check,
  ClipboardCheck,
  ClipboardList,
  FileLock2,
  FileText,
  Gauge,
  GraduationCap,
  House,
  ListChecks,
  LockKeyhole,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { ClientCaseFrame, type ClientCaseOption } from "@/components/portal/ClientCaseFrame";
import { PortalFrame } from "@/components/portal/PortalFrame";
import {
  CASE_STAGE_FLOW,
  getCaseStageDisplayLabel,
  getCaseStatusLabel,
  getPlanDisplayLabel,
} from "@/lib/platform/case-progress";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCaseProgressSummaryForActor } from "@/server/case-progress/operations";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { getPrismaClient } from "@/server/database/prisma";

export const dynamic = "force-dynamic";

const STAFF_MODULES = [
  { code: "progress", title: "Прогресс", description: "Текущий этап и готовность основных материалов дела в одном месте.", icon: Gauge },
  { code: "questionnaire", title: "Анкета", description: "Сведения, необходимые для анализа ситуации и подготовки материалов дела.", icon: ListChecks },
  { code: "practicum", title: "Практикум", description: "Обучающие материалы и прогресс клиента по программе сопровождения.", icon: GraduationCap },
  { code: "documents", title: "Документы", description: "Подготовка документов и их передача на проверку юристу.", icon: FileText },
  { code: "files", title: "Файлы", description: "Безопасное хранение и скачивание проверенных файлов по делу.", icon: FileLock2 },
  { code: "activity", title: "История", description: "Хронология подтверждённых действий и изменений по делу.", icon: Activity },
  { code: "tasks", title: "Задачи", description: "Рабочая очередь задач, относящихся к этому делу.", icon: ClipboardList },
] as const;

type CaseProgressSummary = Awaited<ReturnType<typeof getCaseProgressSummaryForActor>>;

type ClientModule = {
  code: string;
  title: string;
  description: string;
  detail: string;
  icon: LucideIcon;
  href?: string;
  progress?: number;
  locked?: boolean;
};

function stageProgress(summary: CaseProgressSummary) {
  if (!summary.stage.position || summary.stage.total <= 1) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round(((summary.stage.position - 1) / (summary.stage.total - 1)) * 100)),
  );
}

function documentSummary(summary: CaseProgressSummary) {
  if (summary.documents.reviewed > 0) return `${summary.documents.reviewed} проверено юристом`;
  if (summary.documents.sentForReview > 0) return `${summary.documents.sentForReview} на проверке`;
  if (summary.documents.total > 0) return `${summary.documents.total} в работе`;
  return "Пока не сформированы";
}

function buildClientModules(caseId: string, planCode: string, summary: CaseProgressSummary): ClientModule[] {
  const base = `/portal/cases/${caseId}`;
  const mortgageAvailable = planCode === "PRO" || planCode === "INDIVIDUAL";

  return [
    {
      code: "practicum",
      title: "Практикум",
      description: `${summary.practicum.completed} из ${summary.practicum.total} уроков`,
      detail: summary.practicum.percent >= 100 ? "Обучение завершено" : "Продолжайте обучение в удобном темпе",
      icon: BookOpen,
      href: `${base}/practicum`,
      progress: summary.practicum.percent,
    },
    {
      code: "questionnaire",
      title: "Анкета",
      description: summary.questionnaire.percent > 0 ? `${summary.questionnaire.percent}% заполнено` : "Не начата",
      detail: summary.questionnaire.percent >= 100 ? "Данные заполнены" : "Используется при подготовке документов",
      icon: ClipboardCheck,
      href: `${base}/questionnaire`,
      progress: summary.questionnaire.percent,
    },
    {
      code: "documents",
      title: "Документы",
      description: documentSummary(summary),
      detail: "Статусы синхронизированы с материалами дела",
      icon: FileText,
      href: `${base}/documents`,
    },
    {
      code: "progress",
      title: "Прогресс дела",
      description: `Текущий этап: ${summary.stage.label}`,
      detail: `Общий прогресс — ${stageProgress(summary)}%`,
      icon: ChartNoAxesColumnIncreasing,
      href: `${base}/progress`,
      progress: stageProgress(summary),
    },
    {
      code: "mortgage",
      title: "Анализ ипотечного жилья",
      description: mortgageAvailable ? "Включён в ваш тариф" : "Расширенная возможность",
      detail: mortgageAvailable ? "Персональный разбор ситуации" : "Доступно на тарифах ПРО и ИНДИВИДУАЛЬНЫЙ",
      icon: House,
      locked: !mortgageAvailable,
    },
    {
      code: "ai",
      title: "AI-помощник",
      description: "Доступен на вашем тарифе",
      detail: "Информационная помощь с учётом материалов дела",
      icon: Sparkles,
      href: `${base}/ai`,
    },
  ];
}

function ClientModuleCard({ module }: { module: ClientModule }) {
  const Icon = module.icon;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-[#f0eeea] text-[#c13c41]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {module.locked ? <LockKeyhole className="size-4 text-[#a7a49f]" aria-label="Недоступно на текущем тарифе" /> : null}
      </div>
      <h3 className="mt-6 text-lg font-semibold tracking-[-0.025em] text-[#202329]">{module.title}</h3>
      <p className="mt-2 text-sm font-medium text-[#51545a]">{module.description}</p>
      <p className="mt-1 min-h-10 text-xs leading-5 text-[#999690]">{module.detail}</p>
      {typeof module.progress === "number" ? (
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#e9e6e1]" aria-label={`Прогресс ${module.progress}%`}>
          <div className="h-full rounded-full bg-[#b9202b]" style={{ width: `${module.progress}%` }} />
        </div>
      ) : null}
      <p className={`mt-5 text-xs font-semibold ${module.locked ? "text-[#aaa7a2]" : "text-[#6c6964]"}`}>
        {module.locked ? "Недоступно на текущем тарифе" : module.href ? "Открыть раздел" : "Включено в тариф"}
      </p>
    </>
  );

  const className = `block min-h-[235px] rounded-[25px] border p-5 transition ${
    module.locked
      ? "border-black/[0.045] bg-white/45 opacity-70"
      : "border-white/80 bg-white/80 shadow-[0_12px_35px_rgba(75,57,43,0.06)] hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(75,57,43,0.1)]"
  }`;

  return module.href && !module.locked ? <Link href={module.href} className={className}>{body}</Link> : <article className={className}>{body}</article>;
}

async function renderClientDashboard(
  sessionProvider: ReturnType<typeof createProductionSessionProvider>,
  actor: Awaited<ReturnType<typeof getCurrentPlatformActor>>,
  clientCase: Awaited<ReturnType<typeof clientCaseService.getCase>> & {},
  summary: CaseProgressSummary,
) {
  const profile = await getCurrentAccountProfile(sessionProvider);
  const allCases = await clientCaseService.listCases(actor);
  const ownedCases = allCases.filter((item) => item.clientId === actor.userId);
  const caseOptions: ClientCaseOption[] = ownedCases.map((item) => ({
    id: item.id,
    caseNumber: item.caseNumber,
    planLabel: getPlanDisplayLabel(item.planCode, "CLIENT"),
  }));
  const planLabel = getPlanDisplayLabel(clientCase.planCode, "CLIENT");
  const displayName = profile.displayName?.trim() || "Клиент iБюро";
  const firstName = displayName.split(/\s+/u)[0] || "Клиент";
  const assignedLawyer = clientCase.assignedLawyerId
    ? await getPrismaClient().user.findUnique({
        where: { id: clientCase.assignedLawyerId },
        select: { displayName: true },
      })
    : null;
  const specialistName = assignedLawyer?.displayName?.trim() || "Специалист назначается";
  const progress = stageProgress(summary);
  const modules = buildClientModules(clientCase.id, clientCase.planCode, summary);
  const nextActionHref = `/portal/cases/${clientCase.id}/${summary.nextAction.segment}`;

  const activity = [
    summary.documents.reviewed > 0 ? `${summary.documents.reviewed} документ(а) проверено юристом` : null,
    summary.questionnaire.completed > 0 ? `Заполнено разделов анкеты: ${summary.questionnaire.completed}` : null,
    summary.practicum.completed > 0 ? `Завершено уроков практикума: ${summary.practicum.completed}` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <ClientCaseFrame
      caseId={clientCase.id}
      caseNumber={clientCase.caseNumber}
      displayName={displayName}
      planLabel={planLabel}
      cases={caseOptions}
    >
      <div className="space-y-8 sm:space-y-10">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="font-[var(--font-iburo-display)] text-4xl font-semibold leading-none tracking-[-0.035em] text-[#2a2927] sm:text-5xl">
              Добрый день, {firstName}
            </h1>
            <p className="mt-3 text-sm text-[#8a8781]">Вот что происходит с вашим делом сейчас.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full border border-[#b9202b]/20 bg-[#b9202b]/[0.06] px-3 py-1.5 font-bold uppercase tracking-[0.08em] text-[#a62731]">{planLabel}</span>
            <span className="font-medium text-[#88857f]">Дело № {clientCase.caseNumber}</span>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(285px,.75fr)]">
          <div className="relative min-h-[300px] overflow-hidden rounded-[28px] bg-[#c53b40] p-7 text-white shadow-[0_24px_65px_rgba(126,43,43,0.17)] sm:p-8">
            <div className="absolute -right-10 -top-16 size-56 rounded-full border-[24px] border-white/[0.055]" aria-hidden="true" />
            <div className="relative flex h-full flex-col">
              <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-white/75">● Следующий шаг</p>
              <h2 className="mt-8 max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{summary.nextAction.title}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75">{summary.nextAction.description}</p>
              <div className="mt-auto pt-10">
                <Link href={nextActionHref} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#a42a31] shadow-sm transition hover:bg-[#fff8f5]">
                  Перейти к шагу <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          <article className="rounded-[28px] border border-white/80 bg-white/80 p-6 shadow-[0_15px_45px_rgba(75,57,43,0.07)] sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#8d8983]">Состояние дела</p>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#a42a31]"><span className="size-1.5 rounded-full bg-[#b9202b]" />{getCaseStatusLabel(clientCase.status)}</span>
            </div>
            <p className="mt-7 text-xs text-[#999690]">Текущий этап</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[#24272c]">{summary.stage.label}</p>
            <div className="mt-8 flex items-end justify-between gap-4"><p className="text-xs text-[#999690]">Общий прогресс</p><p className="text-3xl font-semibold tracking-[-0.04em]">{progress}%</p></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ebe8e3]"><div className="h-full rounded-full bg-[#b9202b]" style={{ width: `${progress}%` }} /></div>
            <div className="mt-7 border-t border-black/[0.055] pt-5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[#aaa6a0]">Назначенный специалист</p>
              <p className="mt-1.5 text-sm font-semibold text-[#34363a]">{specialistName}</p>
            </div>
          </article>
        </section>

        <section className="rounded-[28px] border border-white/80 bg-white/75 p-6 shadow-[0_12px_40px_rgba(75,57,43,0.055)] sm:p-7">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.03em]">Этапы процедуры</h2>
            <p className="mt-1 text-xs text-[#999690]">Ваш путь от начала работы до завершения дела.</p>
          </div>
          <div className="mt-7 overflow-x-auto pb-2">
            <ol className="grid min-w-[900px] grid-cols-9">
              {CASE_STAGE_FLOW.map((stage, index) => {
                const activeIndex = (summary.stage.position ?? 1) - 1;
                const completed = index < activeIndex;
                const active = index === activeIndex;
                return (
                  <li key={stage.code} className="relative text-center">
                    {index < CASE_STAGE_FLOW.length - 1 ? <span className={`absolute left-1/2 top-3.5 h-px w-full ${index < activeIndex ? "bg-[#b9202b]" : "bg-[#dad7d1]"}`} aria-hidden="true" /> : null}
                    <span className={`relative z-10 mx-auto grid size-7 place-items-center rounded-full border text-[10px] font-bold ${completed ? "border-[#b9202b] bg-[#b9202b] text-white" : active ? "border-[#d59ca0] bg-white text-[#b9202b] shadow-[0_0_0_4px_rgba(185,32,43,0.06)]" : "border-[#dcd9d4] bg-[#eeece8] text-[#989590]"}`}>
                      {completed ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                    </span>
                    <p className={`mx-auto mt-3 max-w-24 text-[10px] leading-4 ${active ? "font-semibold text-[#393a3d]" : "text-[#8f8c86]"}`}>{stage.label}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section aria-labelledby="client-tools-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="client-tools-heading" className="text-3xl font-semibold tracking-[-0.04em] text-[#26282c]">Инструменты</h2>
              <p className="mt-1 text-sm text-[#999690]">Всё необходимое для работы с вашим делом.</p>
            </div>
            <p className="text-xs text-[#aaa7a1]">Доступность зависит от тарифа · AI доступен всем</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => <ClientModuleCard key={module.code} module={module} />)}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(285px,.7fr)]">
          <article className="rounded-[28px] border border-white/80 bg-white/75 p-6 shadow-[0_12px_40px_rgba(75,57,43,0.055)] sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-[-0.03em]">Последняя активность</h2>
              <Link href={`/portal/cases/${clientCase.id}/activity`} className="text-xs font-semibold text-[#9d2b33]">Вся история</Link>
            </div>
            <div className="mt-5 divide-y divide-black/[0.055]">
              {(activity.length ? activity : ["Дело доступно в личном кабинете"]).slice(0, 3).map((item) => (
                <div key={item} className="flex items-center gap-3 py-3 text-sm text-[#55575b]">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f0eeea] text-[#bc3940]"><Activity className="size-3.5" aria-hidden="true" /></span>
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/80 bg-white/75 p-6 shadow-[0_12px_40px_rgba(75,57,43,0.055)] sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999690]">Ваш специалист</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-[#bd1f2b] text-xs font-bold text-white">iБ</span>
              <div><p className="font-semibold text-[#282a2e]">{specialistName}</p><p className="mt-0.5 text-xs text-[#999690]">Сопровождение iБюро</p></div>
            </div>
            <p className="mt-5 text-sm leading-6 text-[#7c7973]">Поможет с организационными вопросами и дальнейшими шагами по вашему делу.</p>
            <Link href={`/portal/cases/${clientCase.id}/activity`} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-[#4a4b4e]">История сопровождения</Link>
          </article>
        </section>
      </div>
    </ClientCaseFrame>
  );
}

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

  const audience = resolveCasePortalAudience(actor, clientCase);
  const isClient = audience === "CLIENT";
  const summary = await getCaseProgressSummaryForActor(actor, clientCase, audience);

  if (isClient) {
    return renderClientDashboard(sessionProvider, actor, clientCase, summary);
  }

  const nextActionHref = `/portal/cases/${clientCase.id}/${summary.nextAction.segment}`;

  return (
    <PortalFrame sectionLabel={`Дело ${clientCase.caseNumber}`} accessLabel="Доступ открыт" showStaffTasks>
      <main className="py-10 sm:py-14">
        <Link href="/portal" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          ← Все дела
        </Link>

        <section className="mt-8 rounded-[32px] border border-white/80 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
              <h1 className="mt-3 break-words font-[var(--font-iburo-display)] text-4xl font-semibold leading-none text-slate-900 sm:text-5xl">Дело клиента</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Здесь собраны основные материалы, этапы и действия по этому делу.</p>
            </div>
            <span className="w-fit shrink-0 rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">{getCaseStatusLabel(clientCase.status)}</span>
          </div>

          <dl className="mt-8 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <div><dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Тариф</dt><dd className="mt-2 text-lg font-bold text-slate-900">{getPlanDisplayLabel(clientCase.planCode, "STAFF")}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Текущий этап</dt><dd className="mt-2 text-lg font-bold text-slate-900">{getCaseStageDisplayLabel(clientCase.stageCode, "STAFF")}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Доступ</dt><dd className="mt-2 text-lg font-bold text-emerald-700">Подтверждён</dd></div>
          </dl>
        </section>

        <section className="mt-6 rounded-[28px] border border-[#7B2330]/15 bg-[#7B2330]/[0.04] p-5 sm:p-7" aria-labelledby="case-next-action-heading">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7B2330]">Требует внимания</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0"><h2 id="case-next-action-heading" className="break-words text-2xl font-bold text-slate-900">{summary.nextAction.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{summary.nextAction.description}</p></div>
            <Link href={nextActionHref} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#17202a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#263342]">Перейти <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="modules-heading">
          <div><h2 id="modules-heading" className="text-lg font-bold text-slate-900">Разделы дела</h2><p className="mt-1 text-sm text-slate-500">Рабочие разделы сотрудника по выбранному делу.</p></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {STAFF_MODULES.map((module) => {
              const Icon = module.icon;
              const prioritized = module.code === summary.nextAction.segment;
              return (
                <Link key={module.code} href={`/portal/cases/${clientCase.id}/${module.code}`} className={`relative rounded-[28px] border p-6 transition hover:-translate-y-0.5 hover:shadow-lg ${prioritized ? "border-[#7B2330]/30 bg-[#7B2330]/[0.04]" : "border-slate-200 bg-white/80 hover:border-slate-300"}`}>
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
