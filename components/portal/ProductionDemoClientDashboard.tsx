import Link from "next/link";
import {
  BookOpen,
  Bot,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  ClipboardList,
  FileText,
  Home,
  LockKeyhole,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

import { ActivityFeed } from "@/components/platform/dashboard/ActivityFeed";
import { NextStepCard } from "@/components/platform/dashboard/NextStepCard";
import { ProcedureProgress } from "@/components/platform/dashboard/ProcedureProgress";
import {
  PlanBadge,
  PlatformCard,
  ProfileAvatar,
  ProgressBar,
  SectionHeader,
} from "@/components/platform/PlatformPrimitives";
import { ClientCaseFrame, type ClientCaseOption } from "@/components/portal/ClientCaseFrame";
import type {
  DashboardActivity,
  DashboardModuleCode,
  DashboardModuleState,
  PlanCode,
} from "@/lib/platform/types";
import { buildCaseActivityView } from "@/server/activity/presentation";
import { listCaseActivity } from "@/server/activity/operations";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";

const MODULE_ICONS: Record<DashboardModuleCode, LucideIcon> = {
  PRACTICUM: BookOpen,
  QUESTIONNAIRE: ClipboardList,
  DOCUMENTS: FileText,
  CASE_PROGRESS: ChartNoAxesColumnIncreasing,
  MORTGAGE: Home,
  AI_ASSISTANT: Bot,
};

type ModuleViewModel = {
  code: DashboardModuleCode;
  title: string;
  summary: string;
  detail: string;
  progress?: number;
  state: DashboardModuleState;
  href?: string;
  lockLabel?: string;
};

type ProductionDemoClientDashboardProps = {
  caseId: string;
  caseNumber: string;
  displayName: string;
  planCode: PlanCode;
  planLabel: string;
  cases: readonly ClientCaseOption[];
  statusLabel: string;
  stageLabel: string;
  stageIndex: number;
  progress: number;
  openedDate: string;
  specialistName: string;
  practicum: {
    completed: number;
    total: number;
    percent: number;
  };
  questionnaire: {
    completed: number;
    total: number;
    percent: number;
  };
  documents: {
    total: number;
    reviewed: number;
    sentForReview: number;
  };
  nextAction: {
    title: string;
    description: string;
    segment: string;
  };
};

function nextActionLabel(segment: string) {
  if (segment === "practicum") return "Перейти к уроку";
  if (segment === "questionnaire") return "Продолжить заполнение";
  if (segment === "documents") return "Открыть документы";
  if (segment === "progress") return "Открыть прогресс";
  return "Перейти к шагу";
}

function documentSummary(documents: ProductionDemoClientDashboardProps["documents"]) {
  if (documents.reviewed > 0) return `${documents.reviewed} проверено юристом`;
  if (documents.sentForReview > 0) return `${documents.sentForReview} на проверке`;
  if (documents.total > 0) return `${documents.total} документа подготовлено`;
  return "Пока не сформированы";
}

function buildModules(props: ProductionDemoClientDashboardProps): ModuleViewModel[] {
  const base = `/portal/cases/${props.caseId}`;
  const mortgageAvailable = props.planCode === "PRO" || props.planCode === "INDIVIDUAL";

  return [
    {
      code: "PRACTICUM",
      title: "Практикум",
      summary: `${props.practicum.completed} из ${props.practicum.total} уроков`,
      detail: props.practicum.percent >= 100 ? "Обучение завершено" : "Продолжайте обучение в удобном темпе",
      progress: props.practicum.percent,
      state: props.practicum.percent >= 100 ? "completed" : "active",
      href: `${base}/practicum`,
    },
    {
      code: "QUESTIONNAIRE",
      title: "Анкета",
      summary: props.questionnaire.percent > 0 ? `${props.questionnaire.completed} из ${props.questionnaire.total} разделов` : "Не начата",
      detail: props.questionnaire.percent >= 100 ? "Данные проверены" : props.questionnaire.percent > 0 ? "Продолжите заполнение анкеты" : "Следующий этап после обучения",
      progress: props.questionnaire.percent,
      state: props.questionnaire.percent >= 100 ? "completed" : props.questionnaire.percent > 0 ? "active" : "upcoming",
      href: `${base}/questionnaire`,
    },
    {
      code: "DOCUMENTS",
      title: "Документы",
      summary: documentSummary(props.documents),
      detail: props.documents.reviewed > 0 ? "Проверены вашим специалистом" : props.documents.sentForReview > 0 ? "Ожидают проверки специалиста" : "Заполняются по данным анкеты",
      state: props.documents.total > 0 ? "active" : "upcoming",
      href: `${base}/documents`,
    },
    {
      code: "CASE_PROGRESS",
      title: "Прогресс дела",
      summary: `Текущий этап: ${props.stageLabel}`,
      detail: `Положение этапа в маршруте — ${props.progress}%`,
      progress: props.progress,
      state: "active",
      href: `${base}/progress`,
    },
    {
      code: "MORTGAGE",
      title: "Анализ ипотечного жилья",
      summary: mortgageAvailable ? "Индивидуальная оценка" : "Расширенная возможность",
      detail: mortgageAvailable ? "Обстоятельства ипотечного жилья оценивает специалист" : "Доступно на тарифах ПРО и ИНДИВИДУАЛЬНЫЙ",
      state: mortgageAvailable ? "active" : "locked",
      lockLabel: "Доступно на тарифах ПРО и ИНДИВИДУАЛЬНЫЙ",
    },
    {
      code: "AI_ASSISTANT",
      title: "AI-помощник",
      summary: "Готов помочь",
      detail: "Учитывает материалы вашего дела",
      state: "active",
      href: `${base}/ai`,
    },
  ];
}

function ProductionCaseOverview(props: Pick<ProductionDemoClientDashboardProps, "statusLabel" | "stageLabel" | "progress" | "openedDate" | "specialistName">) {
  return (
    <PlatformCard className="h-full p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Состояние дела</p>
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
          <span className="size-2 rounded-full bg-primary" />
          {props.statusLabel}
        </span>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">Текущий этап</p>
      <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.04em] sm:text-3xl">{props.stageLabel}</h2>
      <div className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <span className="text-sm text-muted-foreground">Положение этапа в маршруте</span>
          <strong className="shrink-0 text-3xl tracking-[-0.05em]">{props.progress}%</strong>
        </div>
        <ProgressBar value={props.progress} />
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Показывает только место текущего этапа в настроенном маршруте сопровождения. Это не прогноз срока или результата процедуры.
        </p>
      </div>
      <dl className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Дело открыто</dt>
          <dd className="mt-1 text-sm font-semibold">{props.openedDate}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Назначенный юрист</dt>
          <dd className="mt-1 text-sm font-semibold">{props.specialistName}</dd>
        </div>
      </dl>
    </PlatformCard>
  );
}

function ProductionModuleCard({ module }: { module: ModuleViewModel }) {
  const Icon = MODULE_ICONS[module.code];
  const locked = module.state === "locked";
  const label = locked
    ? module.lockLabel
    : module.code === "PRACTICUM"
      ? "Открыть Практикум"
      : module.code === "QUESTIONNAIRE"
        ? "Открыть анкету"
        : module.code === "DOCUMENTS"
          ? "Открыть документы"
          : module.code === "CASE_PROGRESS"
            ? "Открыть прогресс дела"
            : module.code === "AI_ASSISTANT"
              ? "Открыть AI-помощник"
              : "Индивидуальная оценка специалистом";

  const className = `group flex min-h-56 w-full flex-col rounded-[1.4rem] border border-border bg-card p-5 text-left text-card-foreground shadow-[0_14px_40px_rgba(0,0,0,.045)] transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
    module.href && !locked ? "hover:-translate-y-1 hover:border-primary/35" : ""
  } ${module.state === "active" ? "module-card-active border-primary/25" : ""} ${locked ? "cursor-not-allowed opacity-65" : ""}`;

  const content = (
    <>
      <span className="flex w-full items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-muted text-primary"><Icon className="size-5" aria-hidden="true" /></span>
        {locked ? <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" /> : module.state === "completed" ? <CheckCircle2 className="size-5 text-primary" aria-hidden="true" /> : null}
      </span>
      <span className="mt-7 block text-lg font-semibold tracking-[-0.025em]">{module.title}</span>
      <span className="mt-2 block text-sm font-medium">{module.summary}</span>
      <span className="mt-2 block text-xs leading-5 text-muted-foreground">{module.detail}</span>
      <span className="mt-auto block w-full pt-5">
        {typeof module.progress === "number" ? <ProgressBar value={module.progress} /> : null}
        <span className="mt-3 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      </span>
    </>
  );

  return module.href && !locked ? <Link href={module.href} className={className}>{content}</Link> : <article className={className}>{content}</article>;
}

function specialistInitials(name: string) {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "iБ";
}

function ProductionLawyerCard({ caseId, specialistName }: { caseId: string; specialistName: string }) {
  return (
    <PlatformCard className="flex h-full flex-col p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ваш специалист</p>
      <div className="mt-7 flex items-center gap-4">
        <ProfileAvatar initials={specialistInitials(specialistName)} className="size-14" />
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em]">{specialistName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Юрист iБюро</p>
        </div>
      </div>
      <p className="mt-6 text-sm leading-6 text-muted-foreground">Персонально сопровождает дело и проверяет подготовленные материалы.</p>
      <div className="mt-6 flex items-center gap-2 text-xs font-medium"><span className="size-2 rounded-full bg-primary" />Сопровождает ваше дело</div>
      <div className="mt-auto pt-6">
        <Link href={`/portal/cases/${caseId}/activity`} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted">
          <MessageCircle className="size-4" aria-hidden="true" />
          История сопровождения
        </Link>
      </div>
    </PlatformCard>
  );
}

function activityIconType(type: string): DashboardActivity["type"] {
  if (type.startsWith("practicum.")) return "lesson";
  if (type.startsWith("questionnaire.")) return "questionnaire";
  if (type.startsWith("document.") || type.startsWith("file.")) return "document";
  return "lawyer";
}

async function buildActivity(props: ProductionDemoClientDashboardProps): Promise<DashboardActivity[]> {
  const records = await listCaseActivity(createProductionSessionProvider(), props.caseId, 4);
  const clientView = buildCaseActivityView(records, "CLIENT");

  return clientView.map((event, index) => ({
    id: event.id,
    text: event.label,
    dateLabel: event.createdAt.toLocaleString("ru-RU"),
    type: activityIconType(records[index]?.type ?? ""),
  }));
}

export async function ProductionDemoClientDashboard(props: ProductionDemoClientDashboardProps) {
  const firstName = props.displayName.split(/\s+/u)[0] || "Клиент";
  const modules = buildModules(props);
  const activity = await buildActivity(props);
  const nextStepHref = `/portal/cases/${props.caseId}/${props.nextAction.segment}`;

  return (
    <ClientCaseFrame
      caseId={props.caseId}
      caseNumber={props.caseNumber}
      displayName={props.displayName}
      planLabel={props.planLabel}
      cases={props.cases}
    >
      <div className="flex flex-col gap-8 sm:gap-10">
        <SectionHeader
          title={`Добрый день, ${firstName}`}
          description="Вот что происходит с вашим делом сейчас."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <PlanBadge plan={props.planCode} />
              <span className="text-xs font-medium text-muted-foreground sm:text-sm">Дело № {props.caseNumber}</span>
            </div>
          }
        />

        <section aria-label="Главное по делу" className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(21rem,.7fr)]">
          <NextStepCard
            nextStep={{
              title: props.nextAction.title,
              description: props.nextAction.description,
              actionLabel: nextActionLabel(props.nextAction.segment),
            }}
            href={nextStepHref}
          />
          <ProductionCaseOverview
            statusLabel={props.statusLabel}
            stageLabel={props.stageLabel}
            progress={props.progress}
            openedDate={props.openedDate}
            specialistName={props.specialistName}
          />
        </section>

        <ProcedureProgress currentStageIndex={props.stageIndex} />

        <section aria-labelledby="modules-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="modules-title" className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Инструменты</h2>
              <p className="mt-2 text-sm text-muted-foreground">Всё необходимое для работы с вашим делом.</p>
            </div>
            <p className="text-xs text-muted-foreground">Доступность зависит от тарифа · AI доступен всем</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => <ProductionModuleCard key={module.code} module={module} />)}
          </div>
        </section>

        <section aria-label="Активность и специалист" className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]">
          <ActivityFeed activity={activity} />
          <ProductionLawyerCard caseId={props.caseId} specialistName={props.specialistName} />
        </section>
      </div>
    </ClientCaseFrame>
  );
}
