"use client";

import { useEffect } from "react";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Platform route error", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-xl rounded-[2rem] border border-border bg-card p-7 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">iБюро</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Не удалось загрузить кабинет</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Данные не были изменены. Попробуйте повторить загрузку страницы.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Повторить
          </button>
          <a
            href="/app"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
          >
            К выбору профиля
          </a>
        </div>
      </section>
    </main>
  );
}
