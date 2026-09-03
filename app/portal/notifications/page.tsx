import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bell, BellRing, CheckCircle2, Clock3 } from "lucide-react";
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
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  const content = (
    <div className={`client-account-surface ${selectedClientCase ? "py-1 sm:py-2" : "py-10"}`}>
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        В личный кабинет
      </Link>

      <div className="mt-6 flex min-w-0 items-center gap-3 sm:mt-8 sm:gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/80 bg-white/90 text-slate-700 shadow-sm sm:size-12"><Bell className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h1 className="break-words font-[var(--font-iburo-display)] text-4xl font-semibold text-slate-900 sm:text-5xl">Уведомления</h1>
          <p className="mt-1 break-words text-sm leading-6 text-slate-500">Все уведомления вашей учётной записи в одном месте.</p>
        </div>
      </div>

      {notifications.length ? (
        <section className="mt-7 min-w-0 sm:mt-8" aria-labelledby="notifications-inbox-heading">
          <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
            <div className="min-w-0">
              <h2 id="notifications-inbox-heading" className="text-lg font-bold text-slate-900">Входящие</h2>
              <p className="mt-1 text-sm text-slate-500">Всего: {notifications.length}</p>
            </div>
            <span className={`inline-flex min-h-8 w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${unreadCount ? "border-[#7B2330]/15 bg-[#7B2330]/8 text-[#7B2330]" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {unreadCount ? <BellRing className="size-3.5" aria-hidden="true" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
              {unreadCount ? `Непрочитанные: ${unreadCount}` : "Все прочитано"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`min-w-0 rounded-[24px] border bg-white/90 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.055)] transition sm:p-5 ${notification.readAt ? "border-white/80" : "border-[#7B2330]/20 shadow-[0_12px_40px_rgba(123,35,48,0.08)]"}`}
              aria-label={`${notification.readAt ? "Прочитанное" : "Новое"} уведомление: ${notification.title}`}
            >
              <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
                <div className="flex min-w-0 gap-3 sm:gap-4">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${notification.readAt ? "bg-slate-50 text-slate-400" : "bg-[#7B2330]/10 text-[#7B2330]"}`}>
                    {notification.readAt ? <Bell className="size-[18px]" aria-hidden="true" /> : <BellRing className="size-[18px]" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold leading-5 text-slate-900">{notification.title}</p>
                    <p className="mt-1.5 break-words text-sm leading-6 text-slate-500">{notification.body}</p>
                  </div>
                </div>
                {notification.readAt ? (
                  <span className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    Прочитано
                  </span>
                ) : (
                  <span className="inline-flex min-h-7 shrink-0 items-center rounded-full bg-[#7B2330]/10 px-2.5 py-1 text-[11px] font-bold text-[#7B2330]">Новое</span>
                )}
              </div>
              <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-400">
                <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
                <time dateTime={notification.createdAt.toISOString()}>{notification.createdAt.toLocaleString("ru-RU")}</time>
                {notification.readAt ? <span className="text-slate-300" aria-hidden="true">·</span> : null}
                {notification.readAt ? <span>Прочитано</span> : null}
              </div>
              {!notification.readAt ? <MarkNotificationReadButton notificationId={notification.id} /> : null}
            </article>
          ))}
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-[28px] border border-dashed border-slate-300 bg-white/85 p-7 text-center shadow-[0_12px_40px_rgba(15,23,42,0.04)] sm:p-10" aria-labelledby="notifications-empty-heading">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-50 text-slate-400"><Bell className="size-5" aria-hidden="true" /></span>
          <h2 id="notifications-empty-heading" className="mt-4 text-lg font-bold text-slate-900">Уведомлений пока нет</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Когда появятся обновления по учётной записи, они будут отображаться здесь.</p>
        </section>
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
