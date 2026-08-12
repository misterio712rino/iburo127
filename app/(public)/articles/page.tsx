import type { Metadata } from "next";
import {
  Calendar,
  ArrowRight,
  BookOpen,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Статьи",
  description:
    "Полезные статьи о банкротстве физических лиц и списании долгов.",
  alternates: {
    canonical: "/articles",
  },
};

const articles = [
  {
    title: "Что такое банкротство физических лиц простыми словами",
    date: "15 июля 2026",
    category: "Банкротство",
  },
  {
    title: "Какие долги можно списать через процедуру банкротства",
    date: "11 июля 2026",
    category: "Долги",
  },
  {
    title: "5 самых распространённых ошибок должников",
    date: "7 июля 2026",
    category: "Советы",
  },
  {
    title: "Что будет с имуществом при банкротстве",
    date: "2 июля 2026",
    category: "Имущество",
  },
  {
    title: "Как проходит процедура банкротства по шагам",
    date: "27 июня 2026",
    category: "Инструкция",
  },
  {
    title: "Стоит ли проходить процедуру самостоятельно",
    date: "20 июня 2026",
    category: "Практикум",
  },
];

export default function ArticlesPage() {
  return (
    <main className="bg-[#F7F5F2]">

      <section className="py-24">

        <div className="mx-auto max-w-7xl px-6">

          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            База знаний
          </span>

          <h1 className="mt-6 text-6xl font-bold leading-tight text-[#2B2B2B]">
            Полезные статьи
            <br />
            о банкротстве
          </h1>

          <p className="mt-8 max-w-3xl text-xl leading-9 text-[#666]">
            Простые объяснения сложных юридических вопросов.
            Только практическая информация без лишней терминологии.
          </p>

        </div>

      </section>

      <section className="pb-28">

        <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-2 xl:grid-cols-3">

          {articles.map((article) => (

            <article
              key={article.title}
              className="rounded-[32px] border border-[#E8DED5] bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
            >

              <div className="flex items-center justify-between">

                <span className="rounded-full bg-[#7B2330]/10 px-4 py-2 text-sm font-semibold text-[#7B2330]">
                  {article.category}
                </span>

                <BookOpen className="h-6 w-6 text-[#C89A4A]" />

              </div>

              <h2 className="mt-8 text-2xl font-bold text-[#2B2B2B] leading-snug">
                {article.title}
              </h2>

              <div className="mt-8 flex items-center text-[#777]">

                <Calendar className="mr-3 h-5 w-5" />

                {article.date}

              </div>

              <button
                type="button"
                className="mt-10 flex items-center font-semibold text-[#7B2330] transition hover:translate-x-1"
              >

                Читать статью

                <ArrowRight className="ml-3 h-5 w-5" />

              </button>

            </article>

          ))}

        </div>

      </section>

    </main>
  );
}
