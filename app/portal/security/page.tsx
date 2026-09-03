import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { BackupCodesRegenerator } from "@/components/platform/auth/BackupCodesRegenerator";
import { MfaEnrollmentForm } from "@/components/platform/auth/MfaEnrollmentForm";
import { ClientCaseFrame, type ClientCaseOption } from "@/components/portal/ClientCaseFrame";
import { ClientPlanVisualStyles } from "@/components/portal/ClientPlanVisualStyles";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { getPlanDisplayLabel } from "@/lib/platform/case-progress";
import type { PlanCode } from "@/lib/platform/types";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { createProductionSessionProvider, resolveProductionAccountSecurityState } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { listAccessibleClientCases } from "@/server/client-cases/operations";

export const dynamic = "force-dynamic";

function requirePlanCode(value: string): PlanCode {
  if (value === "LITE" || value === "PRO" || value === "INDIVIDUAL") return value;
  throw new Error("UNSUPPORTED_CLIENT_PLAN");
}

export default async function AccountSecurityPage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const state = await resolveProductionAccountSecurityState();
  if (state.status === "UNAUTHENTICATED") redirect("/auth/sign-in");

  const sessionProvider = createProductionSessionProvider();
  const requestedCaseId = (await searchParams).caseId?.trim();
  let profile;
  let cases;
  try {
    [profile, cases] = await Promise.all([
      getCurrentAccountProfile(sessionProvider),
      listAccessibleClientCases(sessionProvider),
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

  const content = (
    <div className="client-account-surface">
      <section className={selectedClientCase ? "py-1 sm:py-2" : "py-10 sm:py-14"}>
        <div className="min-w-0 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7B2330]">Безопасность</p>
          <h1 className="mt-4 break-words font-[var(--font-iburo-display)] text-4xl font-semibold leading-none text-slate-900 sm:text-5xl lg:text-6xl">
            Защита учётной записи
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500">
            Управляйте вторым фактором и резервными кодами. Доступ к делам и функциям кабинета определяется вашей учётной записью и назначенными ролями.
          </p>
        </div>
      </section>

      <section className="grid gap-6 pb-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <article className="min-w-0 rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${state.twoFactorEnabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="break-words text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Двухфакторная защита</p>
              <h2 className="mt-1 break-words text-xl font-bold text-slate-900">
                {state.twoFactorEnabled ? "Подключена" : "Не подключена"}
              </h2>
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-500">
            {state.staff
              ? "Для юристов и руководителей второй фактор обязателен. Отключение второго фактора через кабинет не предоставляется."
              : state.twoFactorEnabled
                ? "При каждом входе после пароля потребуется код из приложения-аутентификатора или одноразовый резервный код."
                : "Для клиента второй фактор добровольный, но рекомендуется для дополнительной защиты документов и персональных данных."}
          </p>
        </article>

        <article className="min-w-0 rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="mb-6 flex min-w-0 items-center gap-3">
            <KeyRound className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
            <h2 className="break-words text-xl font-bold text-slate-900">
              {state.twoFactorEnabled ? "Резервные коды" : "Подключить 2FA"}
            </h2>
          </div>

          {state.twoFactorEnabled ? (
            <BackupCodesRegenerator />
          ) : (
            <MfaEnrollmentForm completionHref={completionHref} />
          )}
        </article>
      </section>
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

  return (
    <PortalFrame sectionLabel="Безопасность аккаунта" accessLabel={accessLabel} showStaffTasks={state.staff}>
      {content}
    </PortalFrame>
  );
}
