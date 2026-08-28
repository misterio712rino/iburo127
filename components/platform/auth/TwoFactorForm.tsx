"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function TwoFactorForm() {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !/^\d{6}$/.test(code)) return;
    setPending(true);
    setError(null);

    try {
      const result = await authClient.twoFactor.verifyTOTP({
        code,
        trustDevice: false,
      });
      if (result.error) {
        setError("Код не принят. Проверьте код в приложении-аутентификаторе.");
        return;
      }
      window.location.assign("/app");
    } catch {
      setError("Не удалось проверить код. Повторите попытку позже.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="totp" className="block text-sm font-semibold text-slate-700">
          Код из приложения-аутентификатора
        </label>
        <input
          id="totp"
          name="totp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-center text-2xl font-semibold tracking-[0.35em] outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !/^\d{6}$/.test(code)}
        className="h-12 w-full rounded-2xl bg-[#17202a] px-5 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Проверяем…" : "Подтвердить вход"}
      </button>
    </form>
  );
}
