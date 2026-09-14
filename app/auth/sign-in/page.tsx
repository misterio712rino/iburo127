import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignInForm } from "@/components/platform/auth/SignInForm";

export default function SignInPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-5 py-10 sm:px-8">
      <section className="w-full max-w-md rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
        <div className="mb-8">
          <IBuroBrand className="font-[var(--font-iburo-display)] text-4xl font-semibold tracking-tight" dot />
          <h1 className="mt-7 font-[var(--font-iburo-display)] text-4xl font-semibold leading-none text-slate-900">
            Вход в приложение
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Введите телефон или электронную почту, которые вы указывали при покупке программы iБюро. Самостоятельная регистрация отключена.
          </p>
        </div>

        <SignInForm />

        <p className="mt-6 text-xs leading-5 text-slate-400">
          Доступ к клиентским данным определяется серверной ролью и назначением на дело, а не данными браузера.
        </p>
      </section>
    </div>
  );
}
