import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileLock2 } from "lucide-react";

import { IBuroFilesV2 } from "@/components/platform/files/IBuroFilesV2";
import { ProductionFiles } from "@/components/platform/files/ProductionFiles";
import { CasePortalFrame } from "@/components/portal/CasePortalFrame";
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
import { listStoredFiles } from "@/server/files/operations";
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

export default async function PortalFilesPage({ params }: { params: Promise<{ caseId: string }> }) {
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

  const files = await listStoredFiles(sessionProvider, caseId);
  const audience = resolveCasePortalAudience(actor, clientCase);
  const fileViews = files.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes.toString(),
    status: file.status,
    readyAt: file.readyAt?.toISOString() ?? null,
    createdAt: file.createdAt.toISOString(),
  }));

  if (audience === "STAFF") {
    return (
      <CasePortalFrame sessionProvider={sessionProvider} actor={actor} clientCase={clientCase} sectionLabel="Файлы дела" showStaffTasks>
        <div className="py-10 sm:py-14">
          <Link href={`/portal/cases/${caseId}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Назад к делу
          </Link>
          <section className="mt-6 rounded-[32px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_55px_rgba(75,57,43,0.07)] sm:p-8">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f0eeea] text-[#b9202b] sm:size-12"><FileLock2 className="size-5 sm:size-6" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.02em] text-slate-400">{getClientCaseDisplayNumber(clientCase.caseNumber)}</p>
                <h1 className="mt-2 break-words font-[var(--font-iburo-display)] text-3xl font-semibold leading-none text-slate-900 sm:text-5xl">Файлы дела</h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Сотруднику доступны только файлы, которые завершили проверку безопасности и разрешены для этого дела.</p>
              </div>
            </div>
            <ProductionFiles caseId={clientCase.id} canUpload={false} initialFiles={fileViews} />
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
      planCode={planCode}
      unreadCount={unreadCount}
      cases={cases}
    >
      <IBuroFilesV2 caseId={clientCase.id} initialFiles={fileViews} />
    </IBuroClientShellV2>
  );
}
