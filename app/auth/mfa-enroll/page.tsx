import { redirect } from "next/navigation";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { MfaEnrollmentForm } from "@/components/platform/auth/MfaEnrollmentForm";
import { resolveProductionStaffMfaState } from "@/server/auth/production-session-provider";

export const dynamic = "force-dynamic";

export default async function MfaEnrollPage() {
  const state = await resolveProductionStaffMfaState();
  if (state.status === "UNAUTHENTICATED") redirect("/auth/sign-in");
  if (state.status !== "REQUIRED") redirect("/portal");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-5 py-10 sm:px-8">
      <section className="w-full max-w-2xl rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
        <IBuroBrand className="font-[var(--font-iburo-display)] text-4xl font-semibold tracking-tight" dot />
        <div className="mt-7 max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7B2330]">Обязательная защита сотрудника</p>
          <h1 className="mt-3 font-[var(--font-iburo-display)] text-4xl font-semibold leading-none text-slate-900 sm:text-5xl">
            Подключите двухфакторную аутентификацию
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Для аккаунтов юристов и руководителей доступ к клиентским данным разрешается только после подключения TOTP. Устройство не будет помечено доверенным.
          </p>
        </div>

        <div className="mt-8">
          <MfaEnrollmentForm />
        </div>
      </section>
    </div>
  );
}
