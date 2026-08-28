"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

function requiresSecondFactor(data: unknown) {
  return Boolean(
    data &&
      typeof data === "object" &&
      "twoFactorRedirect" in data &&
      (data as { twoFactorRedirect?: unknown }).twoFactorRedirect === true,
  );
}

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError("Не удалось войти. Проверьте данные и повторите попытку.");
        return;
      }
      if (!requiresSecondFactor(result.data)) {
        router.replace("/portal");
        router.refresh();
      }
    } catch {
      setError("Сервис входа временно недоступен. Повторите попытку позже.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
          Электронная почта
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
            Пароль
          </label>
          <a href="/auth/forgot-password" className="text-xs font-semibold text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline">
            Забыли пароль?
          </a>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={12}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !email.trim() || password.length < 12 || password.length > 128}
        className="h-12 w-full rounded-2xl bg-[#17202a] px-5 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
