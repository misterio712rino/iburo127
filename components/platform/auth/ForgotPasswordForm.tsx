"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (result.error) {
        setError("Сервис восстановления временно недоступен. Повторите попытку позже.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Сервис восстановления временно недоступен. Повторите попытку позже.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-5">
        <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800">
          Если учётная запись с таким адресом существует, инструкция по восстановлению отправлена на электронную почту.
        </p>
        <a href="/auth/sign-in" className="block text-center text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">
          Вернуться ко входу
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="recovery-email" className="block text-sm font-semibold text-slate-700">
          Электронная почта
        </label>
        <input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
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
        disabled={pending || !email.trim()}
        className="h-12 w-full rounded-2xl bg-[#17202a] px-5 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Отправляем…" : "Получить ссылку"}
      </button>

      <a href="/auth/sign-in" className="block text-center text-sm font-semibold text-slate-600 underline-offset-4 hover:underline">
        Вернуться ко входу
      </a>
    </form>
  );
}
