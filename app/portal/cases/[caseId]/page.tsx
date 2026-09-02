import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  FileLock2,
  FileText,
  Gauge,
  GraduationCap,
  ListChecks,
} from "lucide-react";

import { IndividualClientVisualStyles } from "@/components/portal/IndividualClientVisualStyles";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { ProductionDemoClientDashboard } from "@/components/portal/ProductionDemoClientDashboard";
import {
  getCaseStageDisplayLabel,
  getCaseStatusLabel,
  getPlanDisplayLabel,
} from "@/lib/platform/case-progress";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import type { PlanCode } from "@/lib/platform/types";
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

function stageProgress(summary: CaseProgressSummary) {
  if (!summary.stage.position || summary.stage.total <= 1) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round(((summary.stage.position - 1) / (summary.stage.total - 1)) * 100)),
  );
}

function requirePlanCode(value: string): PlanCode {
  if (value === "LITE" || value === "PRO" || value === "INDIVIDUAL") return value;
  throw new Error("UNSUPPORTED_CLIENT_PLAN");
}

function formatCaseOpenedDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

async function renderClientDashboard(
  sessionProvider: ReturnType<typeof createProductionSessionProvider>,
  actor: Awaited<ReturnType<typeof getCurrentPlatformActor>>,
  clientCase: NonNullable<Awaited<ReturnType<typeof clientCaseService.getCase>>>,
  summary: CaseProgressSummary,
) {
  const [profile, allCases, caseMetadata] = await Promise.all([
    getCurrentAccountProfile(sessionProvider),
    clientCaseService.listCases(actor),
    getPrismaClient().clientCase.findUnique({
      where: { id: clientCase.id },
      select: {
        openedAt: true,
        createdAt: true,
        assignedLawyer: {
          select: { displayName: true },
        },
        plan: {
          select: {
            features: {
              where: { feature: { code: "MORTGAGE_ANALYSIS" } },
              select: { featureId: true },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  const ownedCases = allCases.filter((item) => item.clientId === actor.userId);
  const caseOptions = ownedCases.map((item) => ({
    id: item.id,
    caseNumber: item.caseNumber,
    planLabel: getPlanDisplayLabel(item.planCode, "CLIENT"),
  }));
  const displayName = profile.displayName?.trim() || "Клиент iБюро";
  const specialistName = caseMetadata?.assignedLawyer?.displayName?.trim() || "Специалист назначается";
  const openedAt = caseMetadata?.openedAt ?? caseMetadata?.createdAt ?? new Date();
  const mortgageAvailable = (caseMetadata?.plan.features.length ?? 0) > 0;
  const planCode = requirePlanCode(clientCase.planCode);

  const dashboard = (
    <ProductionDemoClientDashboard
      caseId={clientCase.id}
      caseNumber={clientCase.caseNumber}
      displayName={displayName}
      planCode={planCode}
      planLabel={getPlanDisplayLabel(clientCase.planCode, "CLIENT")}
      cases={caseOptions}
      statusLabel={getCaseStatusLabel(clientCase.status)}
      stageLabel={summary.stage.label}
      stageIndex={Math.max(0, (summary.stage.position ?? 1) - 1)}
      progress={stageProgress(summary)}
      openedDate={formatCaseOpenedDate(openedAt)}
      specialistName={specialistName}
      mortgageAvailable={mortgageAvailable}
      practicum={{
        completed: summary.practicum.completed,
        total: summary.practicum.total,
        percent: summary.practicum.percent,
      }}
      questionnaire={{
        completed: summary.questionnaire.completed,
        total: summary.questionnaire.total,
        percent: summary.questionnaire.percent,
      }}
      documents={{
        total: summary.documents.total,
        reviewed: summary.documents.reviewed,
        sentForReview: summary.documents.sentForReview,
      }}
      nextAction={{
        title: summary.nextAction.title,
        description: summary.nextAction.description,
        segment: summary.nextAction.segment,
      }}
    />
  );

  if (planCode !== "INDIVIDUAL") return dashboard;

  return (
    <>
      <IndividualClientVisualStyles />
      {dashboard}
    </>
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
