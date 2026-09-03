"use client";

import { CheckCircle2, Copy, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Enrollment = {
  totpUri: string;
  backupCodes: string[];
};

type Props = {
  completionHref?: string;
};

function parseEnrollment(data: unknown): Enrollment | null {
  if (!data || typeof data !== "object") return null;
  const record = data as { totpURI?: unknown; backupCodes?: unknown };
  if (typeof record.totpURI !== "string" || !record.totpURI) return null;
  if (!Array.isArray(record.backupCodes) || !record.backupCodes.every((code) => typeof code === "string")) {
    return null;
  }
  return { totpUri: record.totpURI, backupCodes: record.backupCodes };
}

function readSecret(totpUri: string) {
  try {
    return new URL(totpUri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export function MfaEnrollmentForm({ completionHref = "/portal" }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const secret = useMemo(() => (enrollment ? readSecret(enrollment.totpUri) : ""), [enrollment]);

  async function begin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || password.length < 12 || password.length > 128) return;
    setPending(true);
    setError(null);
    setCopied(false);

    try {
      const result = await authClient.twoFactor.enable({
        password,
        method: "totp",
      });
      if (result.error) {
        setError("Не удалось начать подключение 2FA. Проверьте пароль и повторите попытку.");
        return;
      }

      const next = parseEnrollment(result.data);
      if (!next) {
        setError("Не удалось подготовить подключение 2FA. Обновите страницу и повторите попытку.");
        return;
      }
      setEnrollment(next);
      setPassword("");
    } catch {
      setError("Не удалось подключиться к настройке 2FA. Повторите попытку позже.");
    } finally {
      setPending(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim();
    if (pending || !/^\d{6}$/.test(normalized)) return;
    setPending(true);
    setError(null);

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: normalized,
        trustDevice: false,
      });
      if (result.error) {
        setError("Код не принят. Проверьте время на устройстве и текущий код в приложении-аутентификаторе.");
        return;
      }
      router.replace(completionHref);
      router.refresh();
    } catch {
      setError("Не удалось подтвердить код. Повторите попытку позже.");
    } finally {
      setPending(false);
    }
  }

  if (!enrollment) {
    return (
      <form onSubmit={begin} className="space-y-4" aria-busy={pending}>
        <div className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Подготовка</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">Подтвердите пароль, чтобы начать настройку приложения-аутентификатора.</p>
          <div className="mt-4 space-y-2">
          <label htmlFor="mfa-password" className="block text-sm font-semibold text-slate-700">
            Подтвердите текущий пароль
          </label>
          <input
            id="mfa-password"
            name="mfa-password"
            type="password"
            autoComplete="current-password"
            minLength={12}
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-base outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          />
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending || password.length < 12 || password.length > 128}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#17202a] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {pending ? "Подготавливаем…" : "Подключить приложение-аутентификатор"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <section className="min-w-0 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Шаг 1 из 3</p>
        <h2 className="mt-1 break-words text-base font-bold text-slate-900">Добавьте iБюро в аутентификатор</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Откройте ссылку на телефоне или добавьте секрет вручную в Google Authenticator, Microsoft Authenticator, 1Password или другое приложение-аутентификатор.
        </p>
        <a
          href={enrollment.totpUri}
          className="mt-4 inline-flex min-h-11 w-full max-w-full items-center justify-center break-words rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:border-slate-400 sm:w-auto"
        >
          Открыть в приложении-аутентификаторе
        </a>
        {secret ? (
          <div className="mt-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Секрет для ручного ввода</p>
            <code className="mt-2 block break-all text-sm font-semibold text-slate-800">{secret}</code>
            <button type="button" onClick={copySecret} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-xs font-bold text-[#7B2330] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B2330]/25">
              <Copy className="size-3.5" aria-hidden="true" />
              {copied ? "Скопировано" : "Скопировать секрет"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="min-w-0 rounded-[22px] border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/70 text-amber-700"><KeyRound className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-900/60">Шаг 2 из 3</p>
        <h2 className="mt-1 break-words text-base font-bold text-amber-950">Сохраните резервные коды</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900/70">
          Сохраните их отдельно от рабочего устройства. Каждый резервный код одноразовый; после ухода со страницы эти коды больше здесь не показываются.
        </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {enrollment.backupCodes.map((backupCode) => (
            <code key={backupCode} className="min-w-0 break-all rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-950">
              {backupCode}
            </code>
          ))}
        </div>
      </section>

      <form onSubmit={verify} className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm sm:p-5" aria-busy={pending}>
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Шаг 3 из 3</p>
          <label htmlFor="mfa-enrollment-code" className="block text-sm font-semibold text-slate-700">
            Подтвердите шестизначный код из приложения
          </label>
          <input
            id="mfa-enrollment-code"
            name="mfa-enrollment-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-center text-2xl font-semibold tracking-[0.35em] outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          />
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !/^\d{6}$/.test(code)}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#17202a] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {pending ? "Проверяем…" : "Завершить подключение 2FA"}
        </button>
      </form>
    </div>
  );
}
