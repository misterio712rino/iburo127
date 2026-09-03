"use client";

import { useState } from "react";
import { Copy, KeyRound, ShieldCheck } from "lucide-react";
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
        setError("Не удалось получить новый набор резервных кодов. Старые коды не считайте заменёнными.");
        return;
      }

      setBackupCodes(codes);
      setPassword("");
    } catch {
      setError("Не удалось выпустить резервные коды. Повторите попытку позже.");
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
      <div className="min-w-0 space-y-4">
        <div role="status" className="flex min-w-0 items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[15px] leading-6 text-amber-950 sm:p-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/70 text-amber-700"><ShieldCheck className="size-4" aria-hidden="true" /></span>
          <p className="min-w-0">Предыдущие резервные коды заменены. Сохраните новый набор сейчас: после ухода со страницы он здесь больше не показывается.</p>
        </div>
        <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
          {backupCodes.map((code) => (
            <code key={code} className="min-w-0 break-all rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-semibold text-slate-900">
              {code}
            </code>
          ))}
        </div>
        <button
          type="button"
          onClick={copyCodes}
          className="inline-flex min-h-11 w-full max-w-full items-center justify-center gap-2 break-words rounded-2xl border border-slate-300 bg-white px-5 py-3 text-[15px] font-bold text-slate-800 transition hover:border-slate-400 sm:w-auto"
        >
          <Copy className="size-4 shrink-0" aria-hidden="true" />
          {copied ? "Коды скопированы" : "Скопировать все коды"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={regenerate} className="min-w-0 space-y-4" noValidate aria-busy={pending}>
      <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[15px] leading-6 text-amber-950 sm:p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/70 text-amber-700"><KeyRound className="size-4" aria-hidden="true" /></span>
        <p className="min-w-0">Выпуск нового набора немедленно делает предыдущие резервные коды недействительными.</p>
      </div>
      <div className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
        <div className="space-y-2.5">
        <label htmlFor="backup-codes-password" className="block text-[15px] font-semibold text-slate-700">
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
          className="min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-[17px] outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-[15px] leading-6 text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || password.length < 12 || password.length > 128}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#17202a] px-6 py-3 text-[15px] font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Выпускаем…" : "Выпустить новые резервные коды"}
      </button>
    </form>
  );
}
