"use client";

import Link from "next/link";

export default function PublicError({
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <section className="flex min-h-[60vh] items-center justify-center bg-[#F7F5F2] px-6 py-20">
      <div className="w-full max-w-3xl rounded-[36px] border border-[#E8DED5] bg-white p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
          Техническая ошибка
        </p>
        <h1 className="mt-6 text-4xl font-bold tracking-[-0.04em] text-[#2B2B2B] sm:text-5xl">
          Не удалось загрузить страницу
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#666]">
          Попробуйте повторить загрузку. Если ошибка сохраняется, вернитесь на главную страницу или свяжитесь с iБюро.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-[#7B2330] px-7 py-3.5 font-semibold text-white transition hover:bg-[#641B25]"
          >
            Повторить
          </button>
          <Link
            href="/"
            className="rounded-full border border-[#7B2330] px-7 py-3.5 font-semibold text-[#7B2330] transition hover:bg-[#7B2330]/5"
          >
            На главную
          </Link>
          <Link
            href="/contacts"
            className="rounded-full border border-black/10 px-7 py-3.5 font-semibold text-[#2B2B2B] transition hover:bg-black/[0.03]"
          >
            Контакты
          </Link>
        </div>
      </div>
    </section>
  );
}
