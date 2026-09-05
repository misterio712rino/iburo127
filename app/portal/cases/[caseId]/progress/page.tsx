import { notFound, redirect } from "next/navigation";

import { IBuroProgressV2 } from "@/components/platform/progress/IBuroProgressV2";
import { StaffProgressView } from "@/components/platform/progress/StaffProgressView";
import { CasePortalFrame } from "@/components/portal/CasePortalFrame";
import { IBuroClientShellV2 } from "@/components/portal/IBuroClientShellV2";
import { getPlanDisplayLabel } from "@/lib/platform/case-progress";
import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import type { PlanCode } from "@/lib/platform/types";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCaseProgressSummaryForActor } from "@/server/case-progress/operations";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
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
  const summary = await getCaseProgressSummaryForActor(actor, clientCase, audience);
  const caseHref = `/portal/cases/${clientCase.id}`;

  if (audience === "STAFF") {
    return (
      <CasePortalFrame sessionProvider={sessionProvider} actor={actor} clientCase={clientCase} sectionLabel="Прогресс дела" showStaffTasks>
        <StaffProgressView
          caseHref={caseHref}
          nextHref={`${caseHref}/${summary.nextAction.segment}`}
          caseNumber={getClientCaseDisplayNumber(clientCase.caseNumber)}
          summary={summary}
        />
      </CasePortalFrame>
    );
  }

  const planCode = requirePlanCode(clientCase.planCode);
  const [profile, allCases, notifications] = await Promise.all([
    getCurrentAccountProfile(sessionProvider),
    clientCaseService.listCases(actor),
    listNotifications(sessionProvider, 100),
  ]);
  const displayName = profile.displayName?.trim() || "Клиент iБюро";
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
      <IBuroProgressV2 caseId={clientCase.id} summary={summary} />
    </IBuroClientShellV2>
  );
}
