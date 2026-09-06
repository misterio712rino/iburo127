import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";

import { ProductionDocuments } from "@/components/platform/documents/ProductionDocuments";
import { IBuroDocumentsV2 } from "@/components/platform/documents/IBuroDocumentsV2";
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
import { getCaseProgressSummaryForActor } from "@/server/case-progress/operations";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { listCaseDocuments } from "@/server/documents/operations";
import { listNotifications } from "@/server/notifications/operations";

export const dynamic = "force-dynamic";

function requirePlanCode(value: string): PlanCode {
  if (value === "LITE" || value === "PRO" || value === "INDIVIDUAL") return value;
  throw new Error("UNSUPPORTED_CLIENT_PLAN");
}

function getClientPlanLabel(planCode: PlanCode) {
  if (planCode === "INDIVIDUAL") return "Эксклюзив";
  return getPlanDisplayLabel(planCode, "CLIENT");
}

export default async function PortalDocumentsPage({ params }: { params: Promise<{ caseId: string }> }) {
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
  const [documents, summary] = await Promise.all([
    listCaseDocuments(sessionProvider, caseId),
    getCaseProgressSummaryForActor(actor, clientCase, audience),
  ]);
  const documentState = documents.map((document) => ({
    id: document.id,
    documentCode: document.documentCode,
    status: document.status,
    regeneratedAt: document.regeneratedAt?.toISOString() ?? null,
    sentForReviewAt: document.sentForReviewAt?.toISOString() ?? null,
    reviewedAt: document.reviewedAt?.toISOString() ?? null,
    version: document.version,
  }));
  const questionnaire = { completed: summary.questionnaire.completed, total: summary.questionnaire.total, percent: summary.questionnaire.percent };

  if (audience === "STAFF") {
    const canReview =
      !actor.roles.includes("MANAGER") &&
      actor.roles.includes("LAWYER") &&
      clientCase.clientId !== actor.userId &&
      clientCase.assignedLawyerId === actor.userId;
    return (
      <CasePortalFrame sessionProvider={sessionProvider} actor={actor} clientCase={clientCase} sectionLabel="Документы" showStaffTasks>
        <div className="py-10 sm:py-14">
          <ClientCaseModuleIntro
            caseId={clientCase.id}
            caseNumber={getClientCaseDisplayNumber(clientCase.caseNumber)}
            title="Документы"
            description="Документы, которые клиент передал на проверку, показаны первыми. Подтверждение доступно только сотруднику с текущим доступом к делу."
            icon={FileText}
          />
          <section className="mt-6 rounded-[32px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_55px_rgba(75,57,43,0.07)] sm:p-8">
            <ProductionDocuments caseId={clientCase.id} canClientEdit={false} canReview={canReview} questionnaire={questionnaire} initialDocuments={documentState} />
          </section>
        </div>
      </CasePortalFrame>
    );
  }

  const planCode = requirePlanCode(clientCase.planCode);
  const [profile, allCases, notifications] = await Promise.all([
    getCurrentAccountProfile(sessionProvider),
    clientCaseService.listCases(actor),
    listNotifications(sessionProvider, 100),
  ]);
  const storedDisplayName = profile.displayName?.trim() || "Клиент iБюро";
  const displayName = formatProfileDisplayName(storedDisplayName);
  const cases = allCases.filter((item) => item.clientId === actor.userId).map((item) => ({
    id: item.id,
    displayNumber: getClientCaseDisplayNumber(item.caseNumber),
    planLabel: getClientPlanLabel(requirePlanCode(item.planCode)),
  }));

  return (
    <IBuroClientShellV2
      caseId={clientCase.id}
      displayName={displayName}
      caseDisplayNumber={getClientCaseDisplayNumber(clientCase.caseNumber)}
      planLabel={getClientPlanLabel(planCode)}
      unreadCount={notifications.filter((item) => !item.readAt).length}
      cases={cases}
    >
      <IBuroDocumentsV2 caseId={clientCase.id} questionnaire={questionnaire} initialDocuments={documentState} />
    </IBuroClientShellV2>
  );
}
