import { notFound, redirect } from "next/navigation";

import { IBuroPracticumLessonV2 } from "@/components/platform/practicum/IBuroPracticumLessonV2";
import { IBuroClientShellV2 } from "@/components/portal/IBuroClientShellV2";
import { getPlanDisplayLabel } from "@/lib/platform/case-progress";
import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import { getPracticumLesson } from "@/lib/platform/practicum-content";
import { formatProfileDisplayName } from "@/lib/platform/profile-display-name";
import type { PlanCode } from "@/lib/platform/types";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { listNotifications } from "@/server/notifications/operations";
import { getPracticumProgress } from "@/server/practicum/operations";

export const dynamic = "force-dynamic";

function requirePlanCode(value: string): PlanCode {
  if (value === "LITE" || value === "PRO" || value === "INDIVIDUAL") return value;
  throw new Error("UNSUPPORTED_CLIENT_PLAN");
}

function getClientPlanLabel(planCode: PlanCode) {
  if (planCode === "INDIVIDUAL") return "Эксклюзив";
  return getPlanDisplayLabel(planCode, "CLIENT");
}

export default async function PortalPracticumLessonPage({
  params,
}: {
  params: Promise<{ caseId: string; lessonId: string }>;
}) {
  const { caseId, lessonId } = await params;
  const lesson = getPracticumLesson(lessonId);
  if (!lesson) notFound();

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
  if (audience === "STAFF") {
    redirect(`/portal/cases/${caseId}/practicum`);
  }

  const progress = await getPracticumProgress(sessionProvider, caseId);
  if (!progress) {
    redirect(`/portal/cases/${caseId}/practicum`);
  }

  const [profile, allCases, notifications] = await Promise.all([
    getCurrentAccountProfile(sessionProvider),
    clientCaseService.listCases(actor),
    listNotifications(sessionProvider, 100),
  ]);

  const displayName = profile.displayName?.trim()
    ? formatProfileDisplayName(profile.displayName)
    : "Клиент iБюро";
  const planCode = requirePlanCode(clientCase.planCode);
  const caseDisplayNumber = getClientCaseDisplayNumber(clientCase.caseNumber);
  const cases = allCases
    .filter((item) => item.clientId === actor.userId)
    .map((item) => ({
      id: item.id,
      displayNumber: getClientCaseDisplayNumber(item.caseNumber),
      planLabel: getClientPlanLabel(requirePlanCode(item.planCode)),
    }));
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const practicumState = {
    completedLessonIds: [...progress.completedLessonIds],
    version: progress.version,
    completedAt: progress.completedAt?.toISOString() ?? null,
  };

  return (
    <IBuroClientShellV2
      caseId={clientCase.id}
      displayName={displayName}
      caseDisplayNumber={caseDisplayNumber}
      planLabel={getClientPlanLabel(planCode)}
      planCode={planCode}
      unreadCount={unreadCount}
      cases={cases}
    >
      <IBuroPracticumLessonV2
        caseId={clientCase.id}
        lessonId={lesson.id}
        initialState={practicumState}
      />
    </IBuroClientShellV2>
  );
}
