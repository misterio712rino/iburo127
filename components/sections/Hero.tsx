"use client";

import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Brain,
  FileText,
  Scale,
} from "lucide-react";

const benefits = [
  "Федеральный закон №127-ФЗ",
  "Пошаговая система",
  "AI-помощник",
  "Подходит новичкам",
];

const roadmap = [
  {
    number: "01",
    title: "Диагностика",
    text: "Проверяем возможность прохождения процедуры и оцениваем ситуацию.",
    icon: Brain,
  },
  {
    number: "02",
    title: "Подготовка документов",
    text: "Получаете готовые шаблоны и инструкции по заполнению.",
    icon: FileText,
  },
  {
    number: "03",
    title: "Прохождение процедуры",
    text: "Следуете пошаговому алгоритму без дорогостоящих юридических услуг.",
    icon: Scale,
  },
  {
    number: "04",
    title: "Результат",
    text: "Проходите процедуру законно и получаете судебное решение.",
    icon: ShieldCheck,
  },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#F7F5F2]">

      {/* Background */}

      <div className="absolute inset-0">

        <div className="absolute inset-0 bg-gradient-to-b from-white via-[#F7F5F2] to-[#F2EEE8]" />

        <div className="absolute left-1/2 top-0 h-[900px] w-[900px] -translate-x-1/2 rounded-full bg-white/70 blur-[220px]" />

        <div className="absolute -left-60 top-10 h-[650px] w-[650px] rounded-full bg-[#7B2330]/10 blur-[180px]" />

        <div className="absolute -right-60 bottom-0 h-[650px] w-[650px] rounded-full bg-[#C89A4A]/15 blur-[180px]" />

      </div>

      <div className="relative mx-auto max-w-7xl px-6 pt-28 pb-32">

        <div className="grid items-center gap-24 lg:grid-cols-2">

          {/* LEFT */}

          <div>

            <div className="inline-flex items-center gap-3 rounded-full border border-[#E8DED5] bg-white/80 px-5 py-2 backdrop-blur shadow-sm">

              <Sparkles className="h-4 w-4 text-[#C89A4A]" />

              <span className="text-sm font-semibold uppercase tracking-[0.22em] text-[#7B2330]">
                Цифровая система iБюро
              </span>

            </div>

            <h1 className="mt-10 text-[78px] font-bold leading-[0.92] tracking-[-0.06em] text-[#1D1D1F]">

              Освободитесь
              <br />

              <span className="text-[#7B2330]">
                от долгов
              </span>

              <br />

              законно.

            </h1>

            <p className="mt-10 max-w-xl text-[22px] leading-10 text-[#666]">

              iБюро — цифровая система,
              которая помогает пройти процедуру
              банкротства физических лиц
              самостоятельно,
              спокойно и в полном соответствии
              с законодательством Российской Федерации.

            </p>
                        <div className="mt-14 flex flex-wrap gap-5">

              <Link
                href="/bankruptcy-check"
                className="
                  group
                  inline-flex
                  items-center
                  rounded-full
                  bg-[#7B2330]
                  px-9
                  py-5
                  text-lg
                  font-semibold
                  text-white
                  transition-all
                  duration-500
                  hover:-translate-y-1
                  hover:bg-[#651B25]
                  hover:shadow-[0_25px_60px_rgba(123,35,48,.35)]
                "
              >
                Проверить возможность

                <ArrowRight className="ml-3 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />

              </Link>

              <Link
                href="#how"
                className="
                  inline-flex
                  items-center
                  rounded-full
                  border
                  border-[#D8CEC4]
                  bg-white
                  px-9
                  py-5
                  text-lg
                  font-semibold
                  text-[#2B2B2B]
                  transition-all
                  duration-500
                  hover:-translate-y-1
                  hover:border-[#7B2330]
                  hover:shadow-xl
                "
              >
                Как работает система
              </Link>

            </div>

            <div className="mt-16 grid gap-5 sm:grid-cols-2">

              {benefits.map((item) => (

                <div
                  key={item}
                  className="
                    flex
                    items-center
                    gap-4
                  "
                >

                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7B2330]/10">

                    <CheckCircle2 className="h-5 w-5 text-[#7B2330]" />

                  </div>

                  <span className="text-lg text-[#2B2B2B]">

                    {item}

                  </span>

                </div>

              ))}

            </div>

          </div>

          {/* RIGHT */}

          <div className="relative">

            <div className="absolute -left-12 top-20 h-56 w-56 rounded-full bg-[#7B2330]/10 blur-[120px]" />

            <div className="absolute -right-10 bottom-10 h-64 w-64 rounded-full bg-[#C89A4A]/15 blur-[140px]" />

            <div
              className="
                relative
                overflow-hidden
                rounded-[42px]
                border
                border-white/60
                bg-white/70
                backdrop-blur-2xl
                shadow-[0_40px_90px_rgba(0,0,0,.10)]
              "
            >
                            <div className="border-b border-[#EFE7DE] p-10">

                <div className="inline-flex items-center gap-3 rounded-full bg-[#F7F5F2] px-4 py-2">

                  <Sparkles className="h-4 w-4 text-[#C89A4A]" />

                  <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7B2330]">
                    Как это работает
                  </span>

                </div>

                <h2 className="mt-7 text-4xl font-bold leading-tight tracking-[-0.04em] text-[#1D1D1F]">

                  Путь к
                  <br />
                  списанию долгов

                </h2>

                <p className="mt-6 text-lg leading-8 text-[#666]">

                  Мы не продаём «курс».
                  Мы даём систему,
                  которая сопровождает вас
                  от проверки ситуации
                  до получения судебного решения.

                </p>

              </div>

              <div className="space-y-6 p-10">

                {roadmap.map((step) => {

                  const Icon = step.icon;

                  return (

                    <div
                      key={step.number}
                      className="
                        group
                        flex
                        items-start
                        gap-5
                        rounded-3xl
                        border
                        border-[#EFE7DE]
                        bg-white/80
                        p-6
                        transition-all
                        duration-500
                        hover:-translate-y-1
                        hover:border-[#C89A4A]/40
                        hover:shadow-xl
                      "
                    >

                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#7B2330]/10">

                        <Icon className="h-7 w-7 text-[#7B2330]" />

                      </div>

                      <div className="flex-1">

                        <div className="flex items-center gap-3">

                          <span className="text-xs font-bold tracking-[0.25em] text-[#C89A4A]">
                            {step.number}
                          </span>

                          <h3 className="text-xl font-semibold text-[#1D1D1F]">
                            {step.title}
                          </h3>

                        </div>

                        <p className="mt-3 leading-8 text-[#666]">

                          {step.text}

                        </p>

                      </div>

                    </div>

                  );

                })}
                              </div>

              {/* FOOTER */}

              <div className="border-t border-[#EFE7DE] bg-[#FAFAFA] p-10">

                <div className="rounded-3xl border border-[#EFE7DE] bg-white p-8">

                  <div className="flex items-center gap-4">

                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7B2330]/10">

                      <Brain className="h-7 w-7 text-[#7B2330]" />

                    </div>

                    <div>

                      <h3 className="text-xl font-semibold text-[#1D1D1F]">
                        AI-помощник iБюро
                      </h3>

                      <p className="mt-2 leading-8 text-[#666]">
                        Подсказывает следующий шаг, помогает ориентироваться
                        в материалах практикума и быстро находить нужные
                        документы.
                      </p>

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </section>

  );

}