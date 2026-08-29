import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { BackupCodesRegenerator } from "@/components/platform/auth/BackupCodesRegenerator";
import { MfaEnrollmentForm } from "@/components/platform/auth/MfaEnrollmentForm";
import { resolveProductionAccountSecurityState } from "@/server/auth/production-session-provider";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const state = await resolveProductionAccountSecurityState();
  if (state.status === "UNAUTHENTICATED") redirect("/auth/sign-in");

  const accessLabel = state.twoFactorEnabled
    ? "2FA включена"
    : "Сессия подтверждена";

  return (
    <PortalFrame
      sectionLabel="Безопасность аккаунта"
      accessLabel={accessLabel}
      showStaffTasks={state.staff}
    >
      <section className="py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7B2330]">Account security</p>
          <h1 className="mt-4 font-[var(--font-iburo-display)] text-5xl font-semibold leading-none text-slate-900 sm:text-6xl">
            Защита учётной записи
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500">
            Управляйте вторым фактором и резервными кодами. Роль пользователя и доступ к делам по-прежнему определяются только сервером.
          </p>
        </div>
      </section>

      <section className="grid gap-6 pb-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <article className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="flex items-center gap-3">
            <span className={`grid size-11 place-items-center rounded-2xl ${state.twoFactorEnabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Двухфакторная защита</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {state.twoFactorEnabled ? "Подключена" : "Не подключена"}
              </h2>
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-500">
            {state.staff
              ? "Для юристов и руководителей TOTP обязателен. Отключение второго фактора через кабинет не предоставляется."
              : state.twoFactorEnabled
                ? "При каждом входе после пароля потребуется код из приложения-аутентификатора или одноразовый резервный код."
                : "Для клиента второй фактор добровольный, но рекомендуется для дополнительной защиты документов и персональных данных."}
          </p>
        </article>

        <article className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <KeyRound className="size-5 text-slate-500" aria-hidden="true" />
            <h2 className="text-xl font-bold text-slate-900">
              {state.twoFactorEnabled ? "Резервные коды" : "Подключить 2FA"}
            </h2>
          </div>

          {state.twoFactorEnabled ? (
            <BackupCodesRegenerator />
          ) : (
            <MfaEnrollmentForm completionHref="/portal/security" />
          )}
        </article>
      </section>
    </PortalFrame>
  );
}
