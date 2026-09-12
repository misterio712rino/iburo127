"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type GateState =
  | { kind: "IDENTIFIER" }
  | { kind: "PASSWORD"; challenge: string; identifier: string }
  | { kind: "PROSPECT"; identifier: string; purchaseUrl: string }
  | { kind: "ACCOUNT_UNAVAILABLE"; identifier: string };

type GateResponse = {
  ok?: boolean;
  data?:
    | { state: "LOGIN"; challenge: string }
    | { state: "PROSPECT"; purchaseUrl: string }
    | { state: "ACCOUNT_UNAVAILABLE" };
  error?: { code?: string };
};

type SignInResponse = {
  twoFactorRedirect?: boolean;
  error?: { code?: string };
};

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function SignInForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<GateState>({ kind: "IDENTIFIER" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkIdentifier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const trimmed = identifier.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/public/access-gate", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ identifier: trimmed }),
        credentials: "same-origin",
      });
      const body = await readJson<GateResponse>(response);
      if (!response.ok || !body?.ok || !body.data) {
        if (response.status === 400) {
          setError("Введите корректный номер телефона или электронную почту.");
        } else if (response.status === 429) {
          setError("Слишком много попыток. Подождите несколько минут и попробуйте снова.");
        } else {
          setError("Сервис входа временно недоступен. Повторите попытку позже.");
        }
        return;
      }

      if (body.data.state === "LOGIN") {
        setState({ kind: "PASSWORD", challenge: body.data.challenge, identifier: trimmed });
        return;
      }
      if (body.data.state === "PROSPECT") {
        setState({ kind: "PROSPECT", identifier: trimmed, purchaseUrl: body.data.purchaseUrl });
        return;
      }
      setState({ kind: "ACCOUNT_UNAVAILABLE", identifier: trimmed });
    } catch {
      setError("Сервис входа временно недоступен. Повторите попытку позже.");
    } finally {
      setPending(false);
    }
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || state.kind !== "PASSWORD") return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/public/access-gate/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ challenge: state.challenge, password }),
        credentials: "same-origin",
      });
      const body = await readJson<SignInResponse>(response);
      if (!response.ok) {
        setError("Не удалось войти. Проверьте пароль и повторите попытку.");
        return;
      }
      if (body?.twoFactorRedirect) {
        router.replace("/auth/two-factor");
        router.refresh();
        return;
      }
      router.replace("/portal");
      router.refresh();
    } catch {
      setError("Сервис входа временно недоступен. Повторите попытку позже.");
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setPassword("");
    setError(null);
    setState({ kind: "IDENTIFIER" });
  }

  if (state.kind === "PROSPECT") {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-900">Доступ к приложению пока не найден</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Мы сохранили указанный контакт, чтобы не потерять ваш запрос. Если вы ещё не приобретали программу iБюро, перейти к покупке можно на нашем основном сайте.
          </p>
        </div>
        <a
          href={state.purchaseUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#17202a] px-5 text-sm font-bold text-white transition hover:bg-[#263342]"
        >
          Перейти на iburo127.ru
        </a>
        <button
          type="button"
          onClick={reset}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Ввести другие данные
        </button>
        <p className="text-xs leading-5 text-slate-400">
          Если вы уже покупали программу, но доступ не найден, проверьте телефон или email, указанные при покупке, либо свяжитесь с поддержкой через iburo127.ru.
        </p>
      </div>
    );
  }

  if (state.kind === "ACCOUNT_UNAVAILABLE") {
    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-bold text-slate-900">Нужна проверка доступа</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Эти данные связаны с системой, но автоматический вход сейчас недоступен. Пожалуйста, свяжитесь с поддержкой iБюро.
          </p>
        </div>
        <a
          href="https://iburo127.ru/"
          target="_blank"
          rel="noreferrer"
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#17202a] px-5 text-sm font-bold text-white transition hover:bg-[#263342]"
        >
          Открыть iburo127.ru
        </a>
        <button
          type="button"
          onClick={reset}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Ввести другие данные
        </button>
      </div>
    );
  }

  if (state.kind === "PASSWORD") {
    return (
      <form onSubmit={signIn} className="space-y-5" noValidate>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Доступ найден</p>
          <div className="mt-1 flex items-center justify-between gap-4">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-700">{state.identifier}</p>
            <button type="button" onClick={reset} className="shrink-0 text-xs font-bold text-[#7B2330] hover:underline">
              Изменить
            </button>
          </div>
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
            autoFocus
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
          disabled={pending || password.length < 12 || password.length > 128}
          className="h-12 w-full rounded-2xl bg-[#17202a] px-5 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Входим…" : "Войти"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={checkIdentifier} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="identifier" className="block text-sm font-semibold text-slate-700">
          Телефон или электронная почта
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          required
          maxLength={254}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="+7 999 000-00-00 или name@example.ru"
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
        disabled={pending || !identifier.trim()}
        className="h-12 w-full rounded-2xl bg-[#17202a] px-5 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Проверяем…" : "Продолжить"}
      </button>

      <p className="text-xs leading-5 text-slate-400">
        Самостоятельная регистрация отключена. Если активный доступ не найден, указанный контакт будет сохранён, чтобы мы могли помочь с подключением программы. Продолжая, вы соглашаетесь с обработкой контактных данных в соответствии с{" "}
        <a href="/privacy" className="font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700">
          политикой конфиденциальности
        </a>.
      </p>
    </form>
  );
}
