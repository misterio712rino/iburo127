import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  ShieldCheck,
  Scale,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Проверка возможности списания долгов",
  description:
    "Узнайте, подходит ли вам процедура банкротства физических лиц.",
  alternates: {
    canonical: "/bankruptcy-check",
  },
};

const points = [
  "Проверка занимает менее 3 минут",
  "Никаких обязательств",
  "Полностью конфиденциально",
  "На основании законодательства РФ",
];

export default function BankruptcyCheckPage() {
  return (
    <main className="bg-[#F7F5F2]">

      <section className="py-28">

        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2">

          <div>

            <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
              Бесплатная проверка
            </span>

            <h1 className="mt-6 text-6xl font-bold leading-tight text-[#2B2B2B]">
              Подходит ли вам
              <br />
              процедура
              <br />
              банкротства?
            </h1>

            <p className="mt-10 text-xl leading-9 text-[#666]">
              Ответьте на несколько простых вопросов.
              Мы поможем понять, возможно ли законное списание
              долгов именно в вашей ситуации.
            </p>

            <div className="mt-12 space-y-5">

              {points.map((item) => (

                <div
                  key={item}
                  className="flex items-center gap-4"
                >
                  <CheckCircle2 className="h-6 w-6 text-[#7B2330]" />

                  <span className="text-lg text-[#444]">
                    {item}
                  </span>

                </div>

              ))}

            </div>

            <div className="mt-14">

              <Link
                href="#quiz"
                className="inline-flex items-center rounded-full bg-[#7B2330] px-10 py-5 text-lg font-semibold text-white transition hover:bg-[#641B25]"
              >
                Начать проверку

                <ArrowRight className="ml-3 h-5 w-5" />

              </Link>

            </div>

          </div>

          <div>

            <div className="rounded-[40px] bg-[#111111] p-10 text-white shadow-2xl">

              <h2 className="text-3xl font-bold">
                Что вы узнаете
              </h2>

              <div className="mt-10 space-y-6">

                <div className="flex gap-5">

                  <ShieldCheck className="mt-1 h-7 w-7 text-[#C89A4A]" />

                  <div>

                    <h3 className="text-xl font-semibold">
                      Можно ли списать долги
                    </h3>

                    <p className="mt-2 text-white/70">
                      Предварительная оценка вашей ситуации.
                    </p>

                  </div>

                </div>

                <div className="flex gap-5">

                  <Scale className="mt-1 h-7 w-7 text-[#C89A4A]" />

                  <div>

                    <h3 className="text-xl font-semibold">
                      Возможные риски
                    </h3>

                    <p className="mt-2 text-white/70">
                      На что стоит обратить внимание заранее.
                    </p>

                  </div>

                </div>

                <div className="flex gap-5">

                  <CheckCircle2 className="mt-1 h-7 w-7 text-[#C89A4A]" />

                  <div>

                    <h3 className="text-xl font-semibold">
                      Следующий шаг
                    </h3>

                    <p className="mt-2 text-white/70">
                      Получите понятный план дальнейших действий.
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>

      <section
        id="quiz"
        className="pb-28"
      >

        <div className="mx-auto max-w-4xl rounded-[36px] border border-[#E8DED5] bg-white p-14 shadow-xl">

          <h2 className="text-4xl font-bold text-center text-[#2B2B2B]">
            Онлайн-проверка
          </h2>

          <p className="mt-6 text-center text-[#666] text-lg">
            Здесь позже будет размещён интерактивный AI-опросник,
            который автоматически определит вероятность успешного
            прохождения процедуры банкротства.
          </p>

        </div>

      </section>

    </main>
  );
}
