import { redirect } from "next/navigation";
import { Bell, BellRing, CheckCircle2, Clock3 } from "lucide-react";

import { MarkNotificationReadButton } from "@/components/platform/notifications/MarkNotificationReadButton";
import { IBuroClientShellV2 } from "@/components/portal/IBuroClientShellV2";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { getPlanDisplayLabel } from "@/lib/platform/case-progress";
import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";
import { formatProfileDisplayName } from "@/lib/platform/profile-display-name";
import type { PlanCode } from "@/lib/platform/types";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { listAccessibleClientCases } from "@/server/client-cases/operations";
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
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const clientDisplayName = profile.displayName?.trim()
    ? formatProfileDisplayName(profile.displayName)
    : "Клиент iБюро";

  const inbox = (
    <div className="flex min-w-0 flex-col gap-7 py-1 sm:gap-9 sm:py-2">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">Центр событий</p>
          <h1 className="mt-2 break-words font-[var(--font-iburo-display)] text-3xl font-semibold tracking-[-.04em] text-foreground sm:text-5xl">Уведомления</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Все важные обновления по вашей учётной записи и сопровождению дела.</p>
        </div>
        <span className={`inline-flex min-h-8 w-fit items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${unreadCount ? "border-primary/15 bg-primary/6 text-primary" : "border-border bg-white text-muted-foreground"}`}>
          {unreadCount ? <BellRing className="size-3.5" aria-hidden="true" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
          {unreadCount ? `${unreadCount} непрочитанных` : "Всё прочитано"}
        </span>
      </header>

      {notifications.length ? (
        <section aria-labelledby="notifications-inbox-heading">
          <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 id="notifications-inbox-heading" className="text-2xl font-semibold tracking-[-.04em]">Входящие</h2>
              <p className="mt-1 text-sm text-muted-foreground">Всего событий: {notifications.length}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`group min-w-0 rounded-[22px] border bg-card p-4 text-card-foreground shadow-[0_8px_28px_rgba(0,0,0,.035)] transition-colors duration-150 hover:bg-muted/20 sm:p-5 ${notification.readAt ? "border-border" : "border-primary/18"}`}
                aria-label={`${notification.readAt ? "Прочитанное" : "Новое"} уведомление: ${notification.title}`}
              >
                <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 gap-3 sm:gap-4">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${notification.readAt ? "bg-muted text-muted-foreground" : "bg-primary/8 text-primary"}`}>
                      {notification.readAt ? <Bell className="size-[18px]" aria-hidden="true" /> : <BellRing className="size-[18px]" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold leading-5 text-foreground">{notification.title}</p>
                      <p className="mt-1.5 break-words text-sm leading-6 text-muted-foreground">{notification.body}</p>
                    </div>
                  </div>
                  {notification.readAt ? (
                    <span className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"><CheckCircle2 className="size-3.5" aria-hidden="true" />Прочитано</span>
                  ) : (
                    <span className="inline-flex min-h-7 shrink-0 items-center rounded-lg border border-primary/12 bg-primary/6 px-2.5 py-1 text-[11px] font-semibold text-primary">Новое</span>
                  )}
                </div>

                <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
                  <time dateTime={notification.createdAt.toISOString()}>{notification.createdAt.toLocaleString("ru-RU")}</time>
                </div>
                {!notification.readAt ? <MarkNotificationReadButton notificationId={notification.id} /> : null}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-[24px] border border-dashed border-border bg-card/70 p-8 text-center shadow-none sm:p-10" aria-labelledby="notifications-empty-heading">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground"><Bell className="size-5" aria-hidden="true" /></span>
          <h2 id="notifications-empty-heading" className="mt-4 text-lg font-semibold text-foreground">Уведомлений пока нет</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Когда появятся обновления по учётной записи или делу, они отобразятся здесь.</p>
        </section>
      )}
    </div>
  );

  if (selectedClientCase) {
    const planCode = requirePlanCode(selectedClientCase.planCode);
    const caseOptions = cases.map((item) => ({
      id: item.id,
      displayNumber: getClientCaseDisplayNumber(item.caseNumber),
      planLabel: getClientPlanLabel(requirePlanCode(item.planCode)),
    }));

    return (
      <IBuroClientShellV2
        caseId={selectedClientCase.id}
        displayName={clientDisplayName}
        caseDisplayNumber={getClientCaseDisplayNumber(selectedClientCase.caseNumber)}
        planLabel={getClientPlanLabel(planCode)}
        unreadCount={unreadCount}
        cases={caseOptions}
      >
        {inbox}
      </IBuroClientShellV2>
    );
  }

  return <PortalFrame sectionLabel="Уведомления" showStaffTasks={isStaff}>{inbox}</PortalFrame>;
}
