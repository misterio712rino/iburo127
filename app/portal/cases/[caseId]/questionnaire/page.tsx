import { notFound, redirect } from "next/navigation";
import { ListChecks } from "lucide-react";

import { ProductionQuestionnaire } from "@/components/platform/questionnaire/ProductionQuestionnaire";
import { IBuroQuestionnaireV2 } from "@/components/platform/questionnaire/IBuroQuestionnaireV2";
import { CasePortalFrame } from "@/components/portal/CasePortalFrame";
import { ClientCaseModuleIntro } from "@/components/portal/ClientCaseModuleIntro";
import { IBuroClientShellV2 } from "@/components/portal/IBuroClientShellV2";
import { getPlanDisplayLabel } from "@/lib/platform/case-progress";
import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import { formatProfileDisplayName } from "@/lib/platform/profile-display-name";
import type { PlanCode } from "@/lib/platform/types";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { listNotifications } from "@/server/notifications/operations";
import { getQuestionnaire } from "@/server/questionnaire/operations";

export const dynamic = "force-dynamic";

function requirePlanCode(value: string): PlanCode {
  if (value === "LITE" || value === "PRO" || value === "INDIVIDUAL") return value;
  throw new Error("UNSUPPORTED_CLIENT_PLAN");
}

function getClientPlanLabel(planCode: PlanCode) {
  if (planCode === "INDIVIDUAL") return "Эксклюзив";
  return getPlanDisplayLabel(planCode, "CLIENT");
}

export default async function PortalQuestionnairePage({ params }: { params: Promise<{ caseId: string }> }) {
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

  const questionnaire = await getQuestionnaire(sessionProvider, clientCase.id);
  const audience = resolveCasePortalAudience(actor, clientCase);
  const questionnaireState = questionnaire ? {
    status: questionnaire.status,
    answers: questionnaire.answers,
    completedSectionIds: [...questionnaire.completedSectionIds],
    version: questionnaire.version,
    completedAt: questionnaire.completedAt?.toISOString() ?? null,
  } : null;
  const planCode = requirePlanCode(clientCase.planCode);

  if (audience === "STAFF") {
    return (
      <CasePortalFrame sessionProvider={sessionProvider} actor={actor} clientCase={clientCase} sectionLabel="Анкета дела" showStaffTasks>
        <div className="py-10">
          <ClientCaseModuleIntro
            caseId={clientCase.id}
            caseNumber={getClientCaseDisplayNumber(clientCase.caseNumber)}
            title="Анкета"
            description="Сведения клиента, необходимые для анализа ситуации и подготовки материалов дела."
            icon={ListChecks}
          />
          <section className="mt-6 rounded-[32px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_55px_rgba(75,57,43,0.07)] sm:p-8">
            <ProductionQuestionnaire caseId={clientCase.id} canEdit={false} planCode={planCode} initialState={questionnaireState} />
          </section>
        </div>
      </CasePortalFrame>
    );
  }

  const [profile, allCases, notifications] = await Promise.all([
    getCurrentAccountProfile(sessionProvider),
    clientCaseService.listCases(actor),
    listNotifications(sessionProvider, 100),
  ]);
  const displayName = profile.displayName?.trim()
    ? formatProfileDisplayName(profile.displayName)
    : "Клиент iБюро";
  const cases = allCases.filter((item) => item.clientId === actor.userId).map((item) => ({
    id: item.id,
    displayNumber: getClientCaseDisplayNumber(item.caseNumber),
    planLabel: getClientPlanLabel(requirePlanCode(item.planCode)),
  }));
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <IBuroClientShellV2
      caseId={clientCase.id}
      displayName={displayName}
      caseDisplayNumber={getClientCaseDisplayNumber(clientCase.caseNumber)}
      planLabel={getClientPlanLabel(planCode)}
      planCode={planCode}
      unreadCount={unreadCount}
      cases={cases}
    >
      <IBuroQuestionnaireV2 caseId={clientCase.id} planCode={planCode} initialState={questionnaireState} />
    </IBuroClientShellV2>
  );
}
