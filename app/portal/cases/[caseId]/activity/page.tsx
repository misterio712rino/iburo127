import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, ArrowLeft, Clock3 } from "lucide-react";

import { CasePortalFrame } from "@/components/portal/CasePortalFrame";
import { IBuroClientShellV2 } from "@/components/portal/IBuroClientShellV2";
import { getPlanDisplayLabel } from "@/lib/platform/case-progress";
import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import { clientPlanHasHumanSupport } from "@/lib/platform/client-plan-entitlements";
import { formatProfileDisplayName } from "@/lib/platform/profile-display-name";
import type { PlanCode } from "@/lib/platform/types";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { listCaseActivity } from "@/server/activity/operations";
import { buildCaseActivityView } from "@/server/activity/presentation";
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

export default async function PortalCaseActivityPage({ params }: { params: Promise<{ caseId: string }> }) {
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

  const records = await listCaseActivity(sessionProvider, caseId, 100);
  const audience = resolveCasePortalAudience(actor, clientCase);
  const events = buildCaseActivityView(records, audience);

  if (audience === "STAFF") {
    return (
      <CasePortalFrame sessionProvider={sessionProvider} actor={actor} clientCase={clientCase} sectionLabel="История дела" accessLabel="Доступ подтверждён" showStaffTasks>
        <div className="py-10">
          <Link href={`/portal/cases/${caseId}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
            <ArrowLeft className="size-4" aria-hidden="true" />Назад к делу
          </Link>
          <div className="mt-8 flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm"><Activity className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0"><h1 className="break-words font-[var(--font-iburo-display)] text-4xl font-semibold text-slate-900">История действий</h1><p className="mt-1 text-sm text-slate-500">Служебный журнал действий по делу. Технические детали доступны только сотрудникам с подтверждённым доступом.</p></div>
          </div>
          <ActivityList events={events} staff />
        </div>
      </CasePortalFrame>
    );
  }

  const [profile, allCases, notifications] = await Promise.all([
    getCurrentAccountProfile(sessionProvider),
    clientCaseService.listCases(actor),
    listNotifications(sessionProvider, 100),
  ]);
  const planCode = requirePlanCode(clientCase.planCode);
  const humanSupportAvailable = clientPlanHasHumanSupport(planCode);
  const displayName = profile.displayName?.trim()
    ? formatProfileDisplayName(profile.displayName)
    : "Клиент iБюро";
  const caseOptions = allCases
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
      cases={caseOptions}
    >
      <div className="flex min-w-0 flex-col gap-7 py-1 sm:gap-9 sm:py-2">
        <header>
          <p className="text-sm font-semibold text-primary">Хронология дела</p>
          <h1 className="mt-2 break-words font-[var(--font-iburo-display)] text-3xl font-semibold tracking-[-.04em] text-foreground sm:text-5xl">{humanSupportAvailable ? "История сопровождения" : "История дела"}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Основные изменения и действия по вашему делу без содержимого документов, ответов анкеты и внутренних служебных данных.</p>
        </header>
        <ActivityList events={events} />
      </div>
    </IBuroClientShellV2>
  );
}

function ActivityList({
  events,
  staff = false,
}: {
  events: ReturnType<typeof buildCaseActivityView>;
  staff?: boolean;
}) {
  if (!events.length) {
    return (
      <div className={staff
        ? "mt-8 rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm text-slate-500"
        : "rounded-[28px] border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground"}
      >
        {staff ? "История этого дела пока пуста." : "Событий по делу пока нет. Здесь появятся основные этапы дела."}
      </div>
    );
  }

  return (
    <ol className={staff ? "mt-8 space-y-3" : "space-y-3"}>
      {events.map((event) => (
        <li key={event.id} className={staff
          ? "rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
          : "rounded-[24px] border border-border bg-card p-5 text-card-foreground shadow-[0_10px_30px_rgba(0,0,0,.035)] transition-colors duration-200"}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              {!staff ? <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-primary"><Activity className="size-4" aria-hidden="true" /></span> : null}
              <div className="min-w-0">
                <p className={`break-words font-bold ${staff ? "text-slate-900" : "text-foreground"}`}>{event.label}</p>
                {staff && event.technical ? <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{event.technical.type}</p> : null}
              </div>
            </div>
            <time className={`inline-flex shrink-0 items-center gap-1.5 text-xs ${staff ? "text-slate-400" : "text-muted-foreground"}`} dateTime={event.createdAt.toISOString()}>
              {!staff ? <Clock3 className="size-3.5" aria-hidden="true" /> : null}{event.createdAt.toLocaleString("ru-RU")}
            </time>
          </div>
          {staff && event.technical?.metadata && Object.keys(event.technical.metadata).length ? (
            <dl className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {Object.entries(event.technical.metadata).map(([key, value]) => (
                <div key={key} className="max-w-full rounded-xl bg-slate-50 px-3 py-2 text-xs"><dt className="break-all text-slate-400">{key}</dt><dd className="mt-0.5 break-all font-semibold text-slate-700">{String(value)}</dd></div>
              ))}
            </dl>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
