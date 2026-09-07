import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  ShieldCheck,
  Scale,
  ArrowRight,
} from "lucide-react";

import BankruptcyPrecheck from "@/components/sections/BankruptcyPrecheck";

export const metadata: Metadata = {
  title: "Проверка возможности списания долгов",
  description:
    "Узнайте, какие обстоятельства стоит обсудить при предварительной оценке процедуры банкротства физических лиц.",
  alternates: {
    canonical: "/bankruptcy-check",
  },
};

const points = [
  "Проверка занимает менее 3 минут",
  "Никаких обязательств",
  "Полностью конфиденциально",
  "Предварительная информационная оценка",
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
              Оцените вашу
              <br />
              долговую
              <br />
              ситуацию
            </h1>

            <p className="mt-10 text-xl leading-9 text-[#666]">
              Ответьте на несколько простых вопросов.
              Проверка поможет определить, какие обстоятельства
              стоит дополнительно обсудить со специалистом.
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
                Что вы получите
              </h2>

              <div className="mt-10 space-y-6">

                <div className="flex gap-5">

                  <ShieldCheck className="mt-1 h-7 w-7 text-[#C89A4A]" />

                  <div>

                    <h3 className="text-xl font-semibold">
                      Предварительную оценку
                    </h3>

                    <p className="mt-2 text-white/70">
                      Поймёте, есть ли факторы, которые стоит обсудить подробнее.
                    </p>

                  </div>

                </div>

                <div className="flex gap-5">

                  <Scale className="mt-1 h-7 w-7 text-[#C89A4A]" />

                  <div>

                    <h3 className="text-xl font-semibold">
                      Контекст для консультации
                    </h3>

                    <p className="mt-2 text-white/70">
                      Увидите, какие сведения могут потребовать дополнительного анализа.
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
                      При необходимости сможете перейти к консультации через форму iБюро.
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
        className="scroll-mt-28 pb-28"
      >
        <BankruptcyPrecheck />
      </section>

    </main>
  );
}
