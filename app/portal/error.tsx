"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function PortalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-12 sm:px-8">
      <section className="w-full rounded-[32px] border border-red-100 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-9">
        <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-700">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-2xl font-bold text-slate-900">Не удалось загрузить защищённый кабинет</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Данные не были показаны. Повторите запрос; если проблема сохранится, вернитесь позже.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#17202a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#263342]"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Повторить
        </button>
      </section>
    </div>
  );
}
