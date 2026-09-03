import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bell, CheckCircle2 } from "lucide-react";
import { ClientCaseFrame, type ClientCaseOption } from "@/components/portal/ClientCaseFrame";
import { ClientPlanVisualStyles } from "@/components/portal/ClientPlanVisualStyles";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { MarkNotificationReadButton } from "@/components/platform/notifications/MarkNotificationReadButton";
import { getPlanDisplayLabel } from "@/lib/platform/case-progress";
import type { PlanCode } from "@/lib/platform/types";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { listAccessibleClientCases } from "@/server/client-cases/operations";
import { listNotifications } from "@/server/notifications/operations";

export const dynamic = "force-dynamic";

function requirePlanCode(value: string): PlanCode {
  if (value === "LITE" || value === "PRO" || value === "INDIVIDUAL") return value;
  throw new Error("UNSUPPORTED_CLIENT_PLAN");
}

export default async function PortalNotificationsPage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const sessionProvider = createProductionSessionProvider();
  const requestedCaseId = (await searchParams).caseId?.trim();

  let profile;
  let cases;
  let notifications;
  try {
    [profile, cases, notifications] = await Promise.all([
      getCurrentAccountProfile(sessionProvider),
      listAccessibleClientCases(sessionProvider),
      listNotifications(sessionProvider, 100),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) redirect("/auth/sign-in");
    throw error;
  }

  const isStaff = profile.roles.includes("LAWYER") || profile.roles.includes("MANAGER");
  const isClientOnly = profile.roles.includes("CLIENT") && !isStaff;
  const selectedClientCase = isClientOnly
    ? cases.find((item) => item.id === requestedCaseId) ?? cases.find((item) => item.status === "ACTIVE") ?? cases[0]
    : undefined;
  const backHref = selectedClientCase ? `/portal/cases/${selectedClientCase.id}` : "/portal";

  const content = (
    <div className={`client-account-surface ${selectedClientCase ? "py-1 sm:py-2" : "py-10"}`}>
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        В личный кабинет
      </Link>

      <div className="mt-6 flex min-w-0 items-center gap-3 sm:mt-8">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm"><Bell className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h1 className="break-words font-[var(--font-iburo-display)] text-4xl font-semibold text-slate-900 sm:text-5xl">Уведомления</h1>
          <p className="mt-1 break-words text-sm text-slate-500">Здесь собраны уведомления, относящиеся к вашей учётной записи.</p>
        </div>
      </div>

      {notifications.length ? (
        <div className="mt-8 space-y-3">
          {notifications.map((notification) => (
            <article key={notification.id} className="min-w-0 rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-slate-900">{notification.title}</p>
                  <p className="mt-2 break-words text-sm leading-6 text-slate-500">{notification.body}</p>
                </div>
                {notification.readAt ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Прочитано
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-[#7B2330]/10 px-2.5 py-1 text-[11px] font-bold text-[#7B2330]">Новое</span>
                )}
              </div>
              <p className="mt-4 text-xs text-slate-400">{notification.createdAt.toLocaleString("ru-RU")}</p>
              {!notification.readAt ? <MarkNotificationReadButton notificationId={notification.id} /> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-[28px] border border-dashed border-slate-300 bg-white/85 p-8 text-sm text-slate-500">Новых уведомлений пока нет.</div>
      )}
    </div>
  );

  if (selectedClientCase) {
    const caseOptions: ClientCaseOption[] = cases.map((item) => ({
      id: item.id,
      caseNumber: item.caseNumber,
      planLabel: getPlanDisplayLabel(item.planCode, "CLIENT"),
    }));
    const planCode = requirePlanCode(selectedClientCase.planCode);

    return (
      <>
        <ClientPlanVisualStyles planCode={planCode} />
        <ClientCaseFrame
          caseId={selectedClientCase.id}
          caseNumber={selectedClientCase.caseNumber}
          displayName={profile.displayName?.trim() || "Клиент iБюро"}
          planLabel={getPlanDisplayLabel(selectedClientCase.planCode, "CLIENT")}
          cases={caseOptions}
        >
          {content}
        </ClientCaseFrame>
      </>
    );
  }

  return <PortalFrame sectionLabel="Уведомления" showStaffTasks={isStaff}>{content}</PortalFrame>;
}
