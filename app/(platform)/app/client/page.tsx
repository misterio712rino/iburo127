"use client";

import { CaseOverview } from "@/components/platform/dashboard/CaseOverview";
import { ActivityFeed } from "@/components/platform/dashboard/ActivityFeed";
import { LawyerCard } from "@/components/platform/dashboard/LawyerCard";
import { ModuleCard } from "@/components/platform/dashboard/ModuleCard";
import { NextStepCard } from "@/components/platform/dashboard/NextStepCard";
import { ProcedureProgress } from "@/components/platform/dashboard/ProcedureProgress";
import { useDemoIdentity } from "@/components/platform/DemoIdentityProvider";
import { PlanBadge, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { getCaseForIdentity, getDashboardForIdentity } from "@/lib/platform/demo";
import { usePracticumProgress } from "@/components/platform/practicum/usePracticumProgress";
import { useQuestionnaireState } from "@/components/platform/questionnaire/useQuestionnaireState";
import { useDocumentState } from "@/components/platform/documents/useDocumentState";
import { generateDocuments, getQuestionnaireSummary } from "@/lib/platform/demo";
import { ClientRouteGuard } from "@/components/platform/practicum/ClientRouteGuard";

const DEFAULT_CLIENT_ID = "alexander-lite";

export default function ClientPage() {
  return <ClientRouteGuard><ClientDashboard /></ClientRouteGuard>;
}

function ClientDashboard() {
  const { identity } = useDemoIdentity();
  const identityId = identity.role === "CLIENT" ? identity.id : DEFAULT_CLIENT_ID;
  const clientCase = getCaseForIdentity(identityId) ?? getCaseForIdentity(DEFAULT_CLIENT_ID)!;
  const dashboard = getDashboardForIdentity(identityId) ?? getDashboardForIdentity(DEFAULT_CLIENT_ID)!;
  const firstName = identity.role === "CLIENT" ? identity.displayName.split(" ")[0] : "Александр";
  const practicum = usePracticumProgress(identityId);
  const questionnaire = useQuestionnaireState(identityId);
  const documentState = useDocumentState(identityId);
  const documents = generateDocuments(identityId, getQuestionnaireSummary(questionnaire.answers), documentState.state);
  const preparedDocuments = documents.filter((document) => document.status === "ready_for_review" || document.status === "sent_for_review" || document.status === "reviewed");
  const reviewedDocuments = documents.filter((document) => document.status === "reviewed").length;
  const modules = dashboard.modules.map((module) => module.code === "PRACTICUM" ? { ...module, summary: `${practicum.completedCount} из 12 уроков`, detail: practicum.isComplete ? "Обучение завершено" : `Текущий урок: ${practicum.currentLesson?.title ?? "программа завершена"}`, progress: practicum.progress, state: practicum.isComplete ? "completed" as const : "active" as const } : module.code === "QUESTIONNAIRE" ? { ...module, summary: questionnaire.started ? `${questionnaire.completedCount} из 10 разделов` : "Не начата", detail: questionnaire.isComplete ? "Данные проверены" : questionnaire.started ? `Следующий раздел: ${questionnaire.currentSection.title.toLocaleLowerCase("ru")}` : "Следующий этап после обучения", progress: questionnaire.progress, state: questionnaire.isComplete ? "completed" as const : questionnaire.started ? "active" as const : "upcoming" as const } : module.code === "DOCUMENTS" ? { ...module, summary: preparedDocuments.length ? `${preparedDocuments.length} документа подготовлено` : documents.some((document) => document.status === "draft") ? "Есть предварительные черновики" : "Пока не сформированы", detail: reviewedDocuments ? `${reviewedDocuments} проверено юристом` : documentState.state.sentForReviewIds.length ? "Переданы юристу на проверку" : questionnaire.isComplete ? "Ожидают вашей проверки" : "Заполняются по данным анкеты", progress: questionnaire.progress, state: preparedDocuments.length ? "active" as const : "upcoming" as const } : module);
  const nextStep = identityId === "maria-pro" && questionnaire.isComplete ? { title:"Перейти к подготовке документов", description:"Анкета заполнена и готова для следующего этапа.", actionLabel:"Перейти к документам" } : dashboard.nextStep;
  const nextStepHref = identityId === "alexander-lite" ? `/app/client/practicum/${practicum.currentLesson?.id ?? "lesson-1"}` : identityId === "maria-pro" && !questionnaire.isComplete ? "/app/client/questionnaire" : identityId === "dmitry-individual" || questionnaire.isComplete ? "/app/client/documents" : undefined;

  return (
    <PlatformShell>
      <div className="flex flex-col gap-8 sm:gap-10">
        <SectionHeader
          title={`Добрый день, ${firstName}`}
          description="Вот что происходит с вашим делом сейчас."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <PlanBadge plan={clientCase.plan} />
              <span className="text-xs font-medium text-muted-foreground sm:text-sm">Дело № {clientCase.caseNumber}</span>
            </div>
          }
        />

        <section aria-label="Главное по делу" className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(21rem,.7fr)]">
          <NextStepCard nextStep={nextStep} href={nextStepHref} />
          <CaseOverview clientCase={clientCase} />
        </section>

        <ProcedureProgress currentStageIndex={dashboard.currentStageIndex} />

        <section aria-labelledby="modules-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 id="modules-title" className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Инструменты</h2><p className="mt-2 text-sm text-muted-foreground">Всё необходимое для работы с вашим делом.</p></div>
            <p className="text-xs text-muted-foreground">Доступность зависит от тарифа</p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => <ModuleCard key={module.code} module={module} />)}
          </div>
        </section>

        <section aria-label="Активность и специалист" className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]">
          <ActivityFeed activity={dashboard.activity} />
          <LawyerCard description={dashboard.supportDescription} />
        </section>

        <p className="pb-2 text-xs text-muted-foreground">Данные профиля подготовлены для демонстрации и не являются реальными.</p>
      </div>
    </PlatformShell>
  );
}
