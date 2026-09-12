import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { ResetPasswordForm } from "@/components/platform/auth/ResetPasswordForm";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const tokenValue = params.token;
  const errorValue = params.error;
  const token = typeof tokenValue === "string" && tokenValue.length <= 4096 ? tokenValue : null;
  const invalidToken = typeof errorValue === "string" && errorValue === "INVALID_TOKEN";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-5 py-10 sm:px-8">
      <section className="w-full max-w-md rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
        <div className="mb-8">
          <IBuroBrand className="font-[var(--font-iburo-display)] text-4xl font-semibold tracking-tight" dot />
          <h1 className="mt-7 font-[var(--font-iburo-display)] text-4xl font-semibold leading-none text-slate-900">
            Новый пароль
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Используйте новый пароль длиной от 12 до 128 символов. После сброса остальные активные сессии отзываются.
          </p>
        </div>

        <ResetPasswordForm token={token} invalidToken={invalidToken} />
      </section>
    </div>
  );
}
