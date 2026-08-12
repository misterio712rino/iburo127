import type { Metadata } from "next";
import {
  Calculator,
  Wallet,
  CreditCard,
  Scale,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Калькулятор банкротства",
  description:
    "Предварительная оценка возможности прохождения процедуры банкротства физических лиц.",
  alternates: {
    canonical: "/calculator",
  },
};

export default function CalculatorPage() {
  return (
    <main className="bg-[#F7F5F2]">

      {/* Hero */}

      <section className="py-28">

        <div className="mx-auto max-w-7xl px-6">

          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            Онлайн-калькулятор
          </span>

          <h1 className="mt-6 text-6xl font-bold leading-tight text-[#2B2B2B]">
            Рассчитайте,
            <br />
            подходит ли вам
            <br />
            банкротство.
          </h1>

          <p className="mt-10 max-w-3xl text-xl leading-9 text-[#666]">
            Ответьте на несколько вопросов,
            чтобы получить предварительную оценку
            возможности прохождения процедуры
            банкротства физических лиц.
          </p>

        </div>

      </section>

      {/* Calculator */}

      <section className="pb-28">

        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1.1fr_0.9fr]">

          {/* Левая часть */}

          <div className="rounded-[36px] border border-[#E8DED5] bg-white p-10 shadow-xl">

            <div className="flex items-center gap-4">

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7B2330]/10">

                <Calculator className="h-7 w-7 text-[#7B2330]" />

              </div>

              <div>

                <h2 className="text-3xl font-bold text-[#2B2B2B]">
                  Предварительный расчет
                </h2>

                <p className="mt-2 text-[#666]">
                  Заполните данные ниже.
                </p>

              </div>

            </div>

            <div className="mt-10 space-y-6">

              <div>

                <label className="mb-2 block font-medium text-[#444]">
                  Общая сумма долгов
                </label>

                <input
                  type="number"
                  placeholder="Например: 950000"
                  className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
                />

              </div>

              <div>

                <label className="mb-2 block font-medium text-[#444]">
                  Ежемесячный доход
                </label>

                <input
                  type="number"
                  placeholder="Например: 45000"
                  className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
                />

              </div>

              <div>

                <label className="mb-2 block font-medium text-[#444]">
                  Количество кредиторов
                </label>

                <input
                  type="number"
                  placeholder="Например: 5"
                  className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
                />

              </div>

              <button
                type="button"
                className="mt-6 flex w-full items-center justify-center rounded-full bg-[#7B2330] px-8 py-5 text-lg font-semibold text-white transition hover:bg-[#641B25]"
              >

                Рассчитать

                <ArrowRight className="ml-3 h-5 w-5" />

              </button>

            </div>

          </div>

          {/* Правая часть */}

          <div className="rounded-[36px] bg-[#111111] p-10 text-white shadow-2xl">

            <h2 className="text-3xl font-bold">
              Что покажет калькулятор
            </h2>

            <div className="mt-10 space-y-8">

              <div className="flex gap-5">

                <Wallet className="mt-1 h-7 w-7 text-[#C89A4A]" />

                <div>

                  <h3 className="text-xl font-semibold">
                    Предварительная вероятность
                  </h3>

                  <p className="mt-2 text-white/70">
                    Оценка возможности прохождения процедуры.
                  </p>

                </div>

              </div>

              <div className="flex gap-5">

                <CreditCard className="mt-1 h-7 w-7 text-[#C89A4A]" />

                <div>

                  <h3 className="text-xl font-semibold">
                    Возможные ограничения
                  </h3>

                  <p className="mt-2 text-white/70">
                    Какие факторы могут повлиять на процедуру.
                  </p>

                </div>

              </div>

              <div className="flex gap-5">

                <Scale className="mt-1 h-7 w-7 text-[#C89A4A]" />

                <div>

                  <h3 className="text-xl font-semibold">
                    Следующий шаг
                  </h3>

                  <p className="mt-2 text-white/70">
                    Рекомендации по дальнейшим действиям.
                  </p>

                </div>

              </div>

            </div>

            <div className="mt-12 rounded-3xl bg-white/5 p-6">

              <p className="text-lg leading-8 text-white/80">
                В будущем этот калькулятор будет работать на базе
                искусственного интеллекта и автоматически анализировать
                вашу ситуацию, рассчитывая вероятность успешного
                прохождения процедуры банкротства.
              </p>

            </div>

          </div>

        </div>

      </section>

    </main>
  );
}
