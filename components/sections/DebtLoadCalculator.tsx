"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";

type CalculationResult = {
  debt: number;
  income: number;
  creditors: number;
  incomeMonths: number;
  averagePerCreditor: number;
};

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export default function DebtLoadCalculator() {
  const [result, setResult] = useState<CalculationResult | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const debt = Number(data.get("debt"));
    const income = Number(data.get("income"));
    const creditors = Number(data.get("creditors"));

    if (
      !Number.isFinite(debt) ||
      !Number.isFinite(income) ||
      !Number.isFinite(creditors) ||
      debt < 0 ||
      income <= 0 ||
      creditors < 1
    ) {
      setResult(null);
      return;
    }

    setResult({
      debt,
      income,
      creditors,
      incomeMonths: debt / income,
      averagePerCreditor: debt / creditors,
    });
  }

  function handleReset() {
    setResult(null);
  }

  return (
    <form
      onSubmit={handleSubmit}
      onReset={handleReset}
      className="rounded-[36px] border border-[#E8DED5] bg-white p-10 shadow-xl"
    >
      <h2 className="text-3xl font-bold text-[#2B2B2B]">Расчёт долговой нагрузки</h2>
      <p className="mt-3 leading-7 text-[#666]">
        Калькулятор считает только финансовые показатели и не определяет юридическую применимость банкротства.
      </p>

      <div className="mt-10 space-y-6">
        <div>
          <label htmlFor="calculator-debt" className="mb-2 block font-medium text-[#444]">
            Общая сумма долгов, ₽
          </label>
          <input
            id="calculator-debt"
            name="debt"
            type="number"
            min={0}
            max={1_000_000_000}
            step={1000}
            required
            placeholder="Например: 950000"
            className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
          />
        </div>

        <div>
          <label htmlFor="calculator-income" className="mb-2 block font-medium text-[#444]">
            Ежемесячный доход, ₽
          </label>
          <input
            id="calculator-income"
            name="income"
            type="number"
            min={1}
            max={100_000_000}
            step={1000}
            required
            placeholder="Например: 45000"
            className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
          />
        </div>

        <div>
          <label htmlFor="calculator-creditors" className="mb-2 block font-medium text-[#444]">
            Количество кредиторов
          </label>
          <input
            id="calculator-creditors"
            name="creditors"
            type="number"
            min={1}
            max={1000}
            step={1}
            required
            placeholder="Например: 5"
            className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
          />
        </div>

        <button
          type="submit"
          className="mt-6 flex w-full items-center justify-center rounded-full bg-[#7B2330] px-8 py-5 text-lg font-semibold text-white transition hover:bg-[#641B25]"
        >
          Рассчитать нагрузку
          <ArrowRight className="ml-3 h-5 w-5" />
        </button>
      </div>

      {result ? (
        <div aria-live="polite" className="mt-8 rounded-3xl border border-[#E8DED5] bg-[#F7F5F2] p-7">
          <h3 className="text-2xl font-bold text-[#2B2B2B]">Ваши показатели</h3>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-[#666]">Долг в месяцах текущего дохода</dt>
              <dd className="mt-1 text-2xl font-semibold text-[#2B2B2B]">
                {result.incomeMonths.toFixed(1)} мес.
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[#666]">Средний долг на кредитора</dt>
              <dd className="mt-1 text-2xl font-semibold text-[#2B2B2B]">
                {money.format(result.averagePerCreditor)}
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-sm leading-6 text-[#666]">
            Это арифметический расчёт, а не юридическое заключение и не прогноз результата процедуры.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/bankruptcy-check"
              className="inline-flex items-center rounded-full bg-[#7B2330] px-6 py-3 font-semibold text-white transition hover:bg-[#641B25]"
            >
              Пройти предварительную проверку
            </Link>
            <button
              type="reset"
              className="inline-flex items-center rounded-full border border-[#D8CEC4] px-6 py-3 font-semibold text-[#444] transition hover:border-[#7B2330]"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Пересчитать
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
