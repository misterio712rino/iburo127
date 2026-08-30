import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Scale,
  BookOpen,
  Users,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "О компании",
  description:
    "iБюро — современная правовая платформа, которая помогает людям законно пройти процедуру банкротства физических лиц самостоятельно.",
  alternates: {
    canonical: "/about",
  },
};

const advantages = [
  {
    icon: ShieldCheck,
    title: "Только законные решения",
    text: "Мы строим систему исключительно на действующем законодательстве Российской Федерации.",
  },
  {
    icon: Scale,
    title: "Практический опыт",
    text: "Каждый материал основан на реальной судебной практике, а не на теории.",
  },
  {
    icon: BookOpen,
    title: "Понятный язык",
    text: "Мы объясняем сложные юридические процессы простыми словами без перегруженности терминологией.",
  },
  {
    icon: Users,
    title: "Поддержка",
    text: "Вы не остаетесь один. На каждом этапе можно получить помощь и ответы на вопросы.",
  },
];

export const metadataBase = undefined;

export default function AboutPage() {
  return (
    <main className="bg-[#F7F5F2]">

      {/* Hero */}

      <section className="py-28">

        <div className="mx-auto max-w-7xl px-6">

          <div className="max-w-4xl">

            <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
              О компании
            </span>

            <h1 className="mt-6 text-6xl font-bold leading-tight text-[#2B2B2B]">
              Мы создаём систему,
              <br />
              которая помогает людям
              <br />
              начать жизнь без долгов.
            </h1>

            <p className="mt-10 max-w-3xl text-xl leading-9 text-[#666]">
              iБюро — это не юридическая компания в привычном понимании.
              Мы создаём современные цифровые инструменты,
              которые позволяют человеку самостоятельно разобраться
              в процедуре банкротства и пройти её законно,
              уверенно и без лишних расходов.
            </p>

          </div>

        </div>

      </section>

      {/* Миссия */}

      <section className="pb-28">

        <div className="mx-auto max-w-7xl px-6">

          <div className="rounded-[40px] bg-[#111111] p-14 text-white shadow-2xl">

            <h2 className="text-4xl font-bold">
              Наша миссия
            </h2>

            <p className="mt-8 max-w-4xl text-xl leading-9 text-white/80">
              Сделать сложную юридическую процедуру максимально понятной
              для обычного человека.

              <br />
              <br />

              Вместо дорогостоящих консультаций,
              бесконечных поисков информации
              и непонятных юридических документов —
              предоставить единую систему,
              которая пошагово сопровождает человека
              от первого вопроса до полного завершения процедуры.
            </p>

          </div>

        </div>

      </section>

      {/* Преимущества */}

      <section className="pb-28">

        <div className="mx-auto max-w-7xl px-6">

          <h2 className="text-center text-5xl font-bold text-[#2B2B2B]">
            Почему выбирают нас
          </h2>

          <div className="mt-20 grid gap-8 md:grid-cols-2">

            {advantages.map((item) => {

              const Icon = item.icon;

              return (

                <div
                  key={item.title}
                  className="rounded-[32px] border border-[#E8DED5] bg-white p-10 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl"
                >

                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7B2330]/10">

                    <Icon className="h-8 w-8 text-[#7B2330]" />

                  </div>

                  <h3 className="mt-6 text-2xl font-semibold text-[#2B2B2B]">
                    {item.title}
                  </h3>

                  <p className="mt-4 leading-8 text-[#666]">
                    {item.text}
                  </p>

                </div>

              );

            })}

          </div>

        </div>

      </section>

      {/* CTA */}

      <section className="pb-28">

        <div className="mx-auto max-w-7xl px-6">

          <div className="rounded-[40px] bg-[#7B2330] p-14 text-center text-white">

            <h2 className="text-5xl font-bold">
              Начните сегодня.
            </h2>

            <p className="mx-auto mt-8 max-w-3xl text-xl leading-9 text-white/80">
              Чем раньше вы разберётесь в своей ситуации,
              тем быстрее сможете начать новую финансовую жизнь.
            </p>

            <div className="mt-12 flex flex-wrap justify-center gap-6">

              <Link
                href="/praktikum"
                className="rounded-full bg-white px-8 py-4 text-lg font-semibold text-[#7B2330] transition hover:opacity-90"
              >
                Получить доступ
              </Link>

              <Link
                href="/bankruptcy-check"
                className="inline-flex items-center rounded-full border border-white/30 px-8 py-4 text-lg font-semibold text-white transition hover:bg-white/10"
              >
                Проверить возможность

                <ArrowRight className="ml-3 h-5 w-5" />

              </Link>

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}
