"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Props = {
  token: string | null;
  invalidToken: boolean;
};

export function ResetPasswordForm({ token, invalidToken }: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;
    if (password !== confirmation) {
      setError("Пароли не совпадают.");
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setError("Пароль должен содержать от 12 до 128 символов.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError("Ссылка недействительна или срок её действия истёк. Запросите восстановление ещё раз.");
        return;
      }
      setCompleted(true);
    } catch {
      setError("Сервис восстановления временно недоступен. Повторите попытку позже.");
    } finally {
      setPending(false);
    }
  }

  if (completed) {
    return (
      <div className="space-y-5">
        <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-800">
          Новый пароль сохранён. Остальные активные сессии отозваны.
        </p>
        <a href="/auth/sign-in" className="block text-center text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">
          Войти с новым паролем
        </a>
      </div>
    );
  }

  if (!token || invalidToken) {
    return (
      <div className="space-y-5">
        <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
          Ссылка восстановления недействительна или срок её действия истёк.
        </p>
        <a href="/auth/forgot-password" className="block text-center text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">
          Запросить новую ссылку
        </a>
      </div>
    );
  }

  const canSubmit =
    password.length >= 12 &&
    password.length <= 128 &&
    confirmation.length >= 12 &&
    password === confirmation;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700">
          Новый пароль
        </label>
        <input
          id="new-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700">
          Повторите пароль
        </label>
        <input
          id="confirm-password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
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
        disabled={pending || !canSubmit}
        className="h-12 w-full rounded-2xl bg-[#17202a] px-5 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : "Сохранить новый пароль"}
      </button>
    </form>
  );
}
