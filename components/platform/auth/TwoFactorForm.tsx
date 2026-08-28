"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type VerificationMode = "totp" | "backup";

export function TwoFactorForm() {
  const [mode, setMode] = useState<VerificationMode>("totp");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: VerificationMode) {
    setMode(next);
    setCode("");
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim();
    if (pending || (mode === "totp" ? !/^\d{6}$/.test(normalized) : !normalized)) return;
    setPending(true);
    setError(null);

    try {
      const result = mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code: normalized, trustDevice: false })
        : await authClient.twoFactor.verifyBackupCode({
            code: normalized,
            disableSession: false,
            trustDevice: false,
          });

      if (result.error) {
        setError(
          mode === "totp"
            ? "Код не принят. Проверьте код в приложении-аутентификаторе."
            : "Резервный код не принят или уже был использован.",
        );
        return;
      }
      window.location.assign("/portal");
    } catch {
      setError("Не удалось проверить код. Повторите попытку позже.");
    } finally {
      setPending(false);
    }
  }

  const valid = mode === "totp" ? /^\d{6}$/.test(code) : Boolean(code.trim());

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => switchMode("totp")}
          className={`rounded-xl px-3 py-2.5 transition ${mode === "totp" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
        >
          TOTP-код
        </button>
        <button
          type="button"
          onClick={() => switchMode("backup")}
          className={`rounded-xl px-3 py-2.5 transition ${mode === "backup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
        >
          Резервный код
        </button>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="two-factor-code" className="block text-sm font-semibold text-slate-700">
            {mode === "totp" ? "Код из приложения-аутентификатора" : "Одноразовый резервный код"}
          </label>
          <input
            id="two-factor-code"
            name="two-factor-code"
            type="text"
            inputMode={mode === "totp" ? "numeric" : "text"}
            autoComplete="one-time-code"
            maxLength={mode === "totp" ? 6 : 128}
            required
            value={code}
            onChange={(event) =>
              setCode(
                mode === "totp"
                  ? event.target.value.replace(/\D/g, "").slice(0, 6)
                  : event.target.value.slice(0, 128),
              )
            }
            className={`h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 font-semibold outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 ${mode === "totp" ? "text-center text-2xl tracking-[0.35em]" : "text-base"}`}
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !valid}
          className="h-12 w-full rounded-2xl bg-[#17202a] px-5 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Проверяем…" : "Подтвердить вход"}
        </button>
      </form>
    </div>
  );
}
