"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

function parseBackupCodes(data: unknown): string[] | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const backupCodes = (data as { backupCodes?: unknown }).backupCodes;
  if (!Array.isArray(backupCodes) || !backupCodes.every((code) => typeof code === "string")) {
    return null;
  }
  return backupCodes;
}

export function BackupCodesRegenerator() {
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || password.length < 12 || password.length > 128) return;

    setPending(true);
    setError(null);
    setCopied(false);

    try {
      const result = await authClient.twoFactor.generateBackupCodes({ password });
      if (result.error) {
        setError("Не удалось выпустить новые резервные коды. Проверьте пароль и повторите попытку.");
        return;
      }

      const codes = parseBackupCodes(result.data);
      if (!codes?.length) {
        setError("Сервис 2FA вернул неожиданный ответ. Старые коды не считайте заменёнными.");
        return;
      }

      setBackupCodes(codes);
      setPassword("");
    } catch {
      setError("Сервис 2FA временно недоступен. Повторите попытку позже.");
    } finally {
      setPending(false);
    }
  }

  async function copyCodes() {
    if (!backupCodes?.length) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (backupCodes) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Предыдущие резервные коды заменены. Сохраните новый набор сейчас: после ухода со страницы он здесь больше не показывается.
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {backupCodes.map((code) => (
            <code key={code} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
              {code}
            </code>
          ))}
        </div>
        <button
          type="button"
          onClick={copyCodes}
          className="inline-flex rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-slate-400"
        >
          {copied ? "Коды скопированы" : "Скопировать все коды"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={regenerate} className="space-y-5" noValidate>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        Выпуск нового набора немедленно делает предыдущие резервные коды недействительными.
      </div>
      <div className="space-y-2">
        <label htmlFor="backup-codes-password" className="block text-sm font-semibold text-slate-700">
          Подтвердите текущий пароль
        </label>
        <input
          id="backup-codes-password"
          name="backup-codes-password"
          type="password"
          autoComplete="current-password"
          minLength={12}
          maxLength={128}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || password.length < 12 || password.length > 128}
        className="h-12 rounded-2xl bg-[#17202a] px-5 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Выпускаем…" : "Выпустить новые резервные коды"}
      </button>
    </form>
  );
}
