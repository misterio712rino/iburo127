import { redirect } from "next/navigation";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";

import { BackupCodesRegenerator } from "@/components/platform/auth/BackupCodesRegenerator";
import { MfaEnrollmentForm } from "@/components/platform/auth/MfaEnrollmentForm";
import { IBuroClientShellV2 } from "@/components/portal/IBuroClientShellV2";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { getPlanDisplayLabel } from "@/lib/platform/case-progress";
import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";
import { formatProfileDisplayName } from "@/lib/platform/profile-display-name";
import type { PlanCode } from "@/lib/platform/types";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { createProductionSessionProvider, resolveProductionAccountSecurityState } from "@/server/auth/production-session-provider";
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

export default async function AccountSecurityPage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const state = await resolveProductionAccountSecurityState();
  if (state.status === "UNAUTHENTICATED") redirect("/auth/sign-in");

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
  const accessLabel = state.twoFactorEnabled ? "2FA включена" : "Сессия подтверждена";
  const completionHref = selectedClientCase ? `/portal/security?caseId=${selectedClientCase.id}` : "/portal/security";
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const clientDisplayName = profile.displayName?.trim()
    ? formatProfileDisplayName(profile.displayName)
    : "Клиент iБюро";

  const content = (
    <div className="flex min-w-0 flex-col gap-7 py-1 sm:gap-9 sm:py-2">
      <header className="min-w-0 max-w-3xl">
        <p className="text-sm font-semibold text-primary">Безопасность</p>
        <h1 className="mt-2 break-words font-[var(--font-iburo-display)] text-3xl font-semibold tracking-[-.04em] text-foreground sm:text-5xl">Защита учётной записи</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Управляйте двухфакторной защитой и резервными кодами. Доступ к делам по-прежнему определяется только серверной авторизацией.</p>
      </header>

      <section className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]" aria-label="Управление безопасностью учётной записи">
        <article className="min-w-0 rounded-[24px] border border-border bg-card p-5 text-card-foreground shadow-[0_8px_30px_rgba(0,0,0,.035)] sm:p-6 lg:p-7">
          <div className="flex min-w-0 items-center gap-4">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${state.twoFactorEnabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="break-words text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Двухфакторная защита</p>
              <h2 className="mt-1 break-words text-xl font-semibold text-foreground">{state.twoFactorEnabled ? "Подключена" : "Не подключена"}</h2>
            </div>
          </div>

          <span className={`mt-5 inline-flex min-h-7 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${state.twoFactorEnabled ? "border-emerald-200/80 bg-emerald-50 text-emerald-700" : "border-amber-200/80 bg-amber-50 text-amber-700"}`}>
            {state.twoFactorEnabled ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <KeyRound className="size-3.5" aria-hidden="true" />}
            {state.twoFactorEnabled ? "Защита активна" : "Рекомендуется настройка"}
          </span>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {state.staff
              ? "Для юристов и руководителей второй фактор обязателен. Отключение через кабинет не предоставляется."
              : state.twoFactorEnabled
                ? "При входе после пароля потребуется код из приложения-аутентификатора или одноразовый резервный код."
                : "Для клиента второй фактор добровольный, но рекомендуется для дополнительной защиты документов и персональных данных."}
          </p>
        </article>

        <article className="min-w-0 rounded-[24px] border border-border bg-card p-5 text-card-foreground shadow-[0_8px_30px_rgba(0,0,0,.035)] sm:p-6 lg:p-7">
          <div className="mb-5 flex min-w-0 items-start gap-3.5 sm:mb-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-primary"><KeyRound className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Управление доступом</p>
              <h2 className="break-words text-xl font-semibold text-foreground lg:text-2xl">{state.twoFactorEnabled ? "Резервные коды" : "Подключить 2FA"}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{state.twoFactorEnabled ? "Создайте новый набор кодов, если прежний больше недоступен." : "Подтвердите пароль, добавьте приложение-аутентификатор и введите код."}</p>
            </div>
          </div>

          {state.twoFactorEnabled ? <BackupCodesRegenerator /> : <MfaEnrollmentForm completionHref={completionHref} />}
        </article>
      </section>
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
        planCode={planCode}
        unreadCount={unreadCount}
        cases={caseOptions}
      >
        {content}
      </IBuroClientShellV2>
    );
  }

  return <PortalFrame sectionLabel="Безопасность аккаунта" accessLabel={accessLabel} showStaffTasks={state.staff}>{content}</PortalFrame>;
}
