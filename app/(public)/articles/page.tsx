import type { Metadata } from "next";
import { Calendar, BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Статьи",
  description:
    "База знаний iБюро готовится к публикации. Материалы будут открыты после редакционной и юридической проверки.",
  alternates: {
    canonical: "/articles",
  },
  robots: {
    index: false,
    follow: false,
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
            База знаний готовится к публикации. Мы откроем материалы после
            редакционной и юридической проверки, чтобы не публиковать неполный
            или неподтверждённый контент.
          </p>
        </div>
      </section>

      <section className="pb-28">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <article
              key={article.title}
              className="rounded-[32px] border border-[#E8DED5] bg-white p-8 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#7B2330]/10 px-4 py-2 text-sm font-semibold text-[#7B2330]">
                  {article.category}
                </span>
                <BookOpen className="h-6 w-6 text-[#C89A4A]" />
              </div>

              <h2 className="mt-8 text-2xl font-bold leading-snug text-[#2B2B2B]">
                {article.title}
              </h2>

              <div className="mt-8 flex items-center text-[#777]">
                <Calendar className="mr-3 h-5 w-5" />
                {article.date}
              </div>

              <span className="mt-10 inline-flex rounded-full bg-[#F7F5F2] px-4 py-2 text-sm font-semibold text-[#666]">
                Материал готовится
              </span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
