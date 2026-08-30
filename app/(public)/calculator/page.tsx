import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, Wallet, CreditCard, Scale } from "lucide-react";

import DebtLoadCalculator from "@/components/sections/DebtLoadCalculator";

export const metadata: Metadata = {
  title: "Калькулятор долговой нагрузки",
  description:
    "Арифметический расчет долговой нагрузки без юридических выводов о применимости процедуры банкротства.",
  alternates: {
    canonical: "/calculator",
  },
};

export default function CalculatorPage() {
  return (
    <main className="bg-[#F7F5F2]">
      <section className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            Онлайн-калькулятор
          </span>

          <h1 className="mt-6 text-6xl font-bold leading-tight text-[#2B2B2B]">
            Оцените вашу
            <br />
            долговую нагрузку.
          </h1>

          <p className="mt-10 max-w-3xl text-xl leading-9 text-[#666]">
            Рассчитайте отношение общей суммы долгов к текущему месячному доходу
            и среднюю сумму долга на одного кредитора. Эти показатели помогают
            описать финансовую ситуацию, но не определяют юридическую возможность
            или результат процедуры банкротства.
          </p>
        </div>
      </section>

      <section className="pb-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <DebtLoadCalculator />

          <div className="rounded-[36px] bg-[#111111] p-10 text-white shadow-2xl">
            <h2 className="text-3xl font-bold">Что покажет калькулятор</h2>

            <div className="mt-10 space-y-8">
              <div className="flex gap-5">
                <Wallet className="mt-1 h-7 w-7 text-[#C89A4A]" />
                <div>
                  <h3 className="text-xl font-semibold">Долг в месяцах дохода</h3>
                  <p className="mt-2 text-white/70">
                    Сколько текущих месячных доходов составляет общая сумма долгов.
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <CreditCard className="mt-1 h-7 w-7 text-[#C89A4A]" />
                <div>
                  <h3 className="text-xl font-semibold">Средний долг на кредитора</h3>
                  <p className="mt-2 text-white/70">
                    Арифметическое распределение общей суммы долгов между указанным числом кредиторов.
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <Scale className="mt-1 h-7 w-7 text-[#C89A4A]" />
                <div>
                  <h3 className="text-xl font-semibold">Следующий шаг</h3>
                  <p className="mt-2 text-white/70">
                    Для предварительной оценки обстоятельств банкротства используйте отдельную проверку iБюро.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-12 rounded-3xl bg-white/5 p-6">
              <p className="text-lg leading-8 text-white/80">
                Калькулятор выполняет только арифметический расчет. Он не является
                юридическим заключением, не прогнозирует исход процедуры и не заменяет
                анализ документов и обстоятельств конкретного дела.
              </p>

              <Link
                href="/bankruptcy-check"
                className="mt-6 inline-flex items-center rounded-full border border-white/20 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Перейти к предварительной проверке
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
