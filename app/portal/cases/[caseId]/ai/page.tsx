import { notFound, redirect } from "next/navigation";

import { AiAssistant } from "@/components/platform/ai/AiAssistant";
import { IBuroClientShellV2 } from "@/components/portal/IBuroClientShellV2";
import { getPlanDisplayLabel } from "@/lib/platform/case-progress";
import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";
import { formatProfileDisplayName } from "@/lib/platform/profile-display-name";
import type { PlanCode } from "@/lib/platform/types";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
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

export default async function PortalCaseAiPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const sessionProvider = createProductionSessionProvider();

  let actor;
  try {
    actor = await getCurrentPlatformActor(sessionProvider);
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) redirect("/auth/sign-in");
    throw error;
  }

  if (!actor.roles.includes("CLIENT")) notFound();

  const clientCase = await clientCaseService.getCase(actor, { caseId });
  if (!clientCase || clientCase.clientId !== actor.userId) notFound();

  const [profile, allCases, notifications] = await Promise.all([
    getCurrentAccountProfile(sessionProvider),
    clientCaseService.listCases(actor),
    listNotifications(sessionProvider, 100),
  ]);
  const displayName = profile.displayName?.trim()
    ? formatProfileDisplayName(profile.displayName)
    : "Клиент iБюро";
  const planCode = requirePlanCode(clientCase.planCode);
  const cases = allCases
    .filter((item) => item.clientId === actor.userId)
    .map((item) => ({
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
      unreadCount={unreadCount}
      cases={cases}
    >
      <section className="flex min-w-0 flex-col gap-6 py-1 sm:gap-8 sm:py-2">
        <header>
          <p className="text-sm font-semibold text-[#b9202b]">Умный помощник</p>
          <h1 className="mt-2 font-[var(--font-iburo-display)] text-3xl font-semibold tracking-[-.04em] text-slate-950 sm:text-5xl">AI-помощник</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Задавайте вопросы по материалам своего дела. Помощник учитывает доступный контекст, но не заменяет финальное юридическое заключение специалиста.</p>
        </header>
        <div className="rounded-[28px] border border-[#e8e8e6] bg-white p-4 shadow-[0_14px_42px_rgba(15,23,42,.045)] sm:p-7">
          <AiAssistant caseId={clientCase.id} withShell={false} />
        </div>
      </section>
    </IBuroClientShellV2>
  );
}
