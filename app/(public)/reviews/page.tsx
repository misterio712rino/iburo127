import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Отзывы",
  description:
    "Отзывы клиентов iБюро публикуются только после подтверждения источника и согласия на публикацию.",
  alternates: {
    canonical: "/reviews",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ReviewsPage() {
  return (
    <main className="bg-[#F7F5F2]">
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            Отзывы клиентов
          </span>

          <h1 className="mt-6 text-5xl font-bold leading-tight text-[#2B2B2B] md:text-6xl">
            Публикуем только
            <br />
            подтверждённые отзывы.
          </h1>

          <p className="mt-8 max-w-3xl text-xl leading-9 text-[#666]">
            Мы не публикуем неподтверждённые истории как реальные отзывы клиентов.
            Этот раздел будет открыт для индексации после проверки источников и
            получения согласий на публикацию.
          </p>

          <div className="mt-12 rounded-[36px] border border-[#E8DED5] bg-white p-10 shadow-lg">
            <h2 className="text-3xl font-bold text-[#2B2B2B]">
              Нужна консультация по вашей ситуации?
            </h2>
            <p className="mt-4 max-w-2xl leading-8 text-[#666]">
              Используйте наши опубликованные контакты или отправьте заявку через
              защищённую форму обратной связи.
            </p>
            <Link
              href="/contacts"
              className="mt-8 inline-flex rounded-full bg-[#7B2330] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[#641B25]"
            >
              Связаться с iБюро
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
