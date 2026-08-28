import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { TwoFactorForm } from "@/components/platform/auth/TwoFactorForm";

export default function TwoFactorPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-5 py-10 sm:px-8">
      <section className="w-full max-w-md rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
        <IBuroBrand className="font-[var(--font-iburo-display)] text-4xl font-semibold tracking-tight" dot />
        <h1 className="mt-7 font-[var(--font-iburo-display)] text-4xl font-semibold leading-none text-slate-900">
          Подтверждение входа
        </h1>
        <p className="mb-7 mt-3 text-sm leading-6 text-slate-500">
          Введите шестизначный TOTP-код. Для защищённых рабочих аккаунтов второй фактор не пропускается.
        </p>
        <TwoFactorForm />
      </section>
    </div>
  );
}
