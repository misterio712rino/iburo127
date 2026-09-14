import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F5F2] px-6 py-20 text-[#2B2B2B]">
      <section className="w-full max-w-3xl rounded-[36px] border border-[#E8DED5] bg-white p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
          Ошибка 404
        </p>
        <h1 className="mt-6 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
          Страница не найдена
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#666]">
          Возможно, адрес изменился или ссылка устарела. Вернитесь на главную страницу или перейдите к услугам iБюро.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="rounded-full bg-[#7B2330] px-7 py-3.5 font-semibold text-white transition hover:bg-[#641B25]"
          >
            На главную
          </Link>
          <Link
            href="/services"
            className="rounded-full border border-[#7B2330] px-7 py-3.5 font-semibold text-[#7B2330] transition hover:bg-[#7B2330]/5"
          >
            Услуги
          </Link>
        </div>
      </section>
    </main>
  );
}
