"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";

type Assessment = "discuss" | "review";

type AssessmentResult = {
  kind: Assessment;
  title: string;
  text: string;
};

function getAssessment(form: HTMLFormElement): AssessmentResult {
  const data = new FormData(form);
  const debt = Number(data.get("debt"));
  const overdue = data.get("overdue") === "yes";
  const paymentDifficulty = data.get("paymentDifficulty") === "yes";
  const enforcement = data.get("enforcement") === "yes";

  const strongSignals = [overdue, paymentDifficulty, enforcement].filter(Boolean).length;

  if ((Number.isFinite(debt) && debt >= 300_000 && strongSignals >= 1) || strongSignals >= 2) {
    return {
      kind: "discuss",
      title: "Есть основания обсудить ситуацию с юристом",
      text:
        "По вашим ответам есть факторы, которые могут быть значимы при выборе способа урегулирования долгов. Для вывода о применимости процедуры нужно проверить документы, состав обязательств, имущество, доходы и другие обстоятельства.",
    };
  }

  return {
    kind: "review",
    title: "Нужна дополнительная оценка ситуации",
    text:
      "По этим четырём ответам недостаточно данных для содержательного вывода. Это не означает, что банкротство подходит или не подходит: решение требует анализа документов, обязательств, имущества, доходов и истории платежей.",
  };
}

export default function BankruptcyPrecheck() {
  const [result, setResult] = useState<AssessmentResult | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(getAssessment(event.currentTarget));
  }

  function handleReset() {
    setResult(null);
  }

  return (
    <div className="mx-auto max-w-4xl rounded-[36px] border border-[#E8DED5] bg-white p-8 shadow-xl sm:p-14">
      <h2 className="text-center text-4xl font-bold text-[#2B2B2B]">
        Предварительная онлайн-проверка
      </h2>

      <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-[#666]">
        Ответьте на четыре фактических вопроса. Результат носит информационный характер и не является юридическим заключением.
      </p>

      <form className="mt-10 space-y-8" onSubmit={handleSubmit} onReset={handleReset}>
        <div>
          <label htmlFor="precheck-debt" className="mb-3 block font-semibold text-[#2B2B2B]">
            Примерная общая сумма долгов, ₽
          </label>
          <input
            id="precheck-debt"
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

        {[
          {
            name: "overdue",
            question: "Есть ли сейчас просроченные платежи по долгам?",
          },
          {
            name: "paymentDifficulty",
            question: "Испытываете ли вы устойчивые трудности с внесением обязательных платежей?",
          },
          {
            name: "enforcement",
            question: "Есть ли исполнительные производства или взыскание по долгам?",
          },
        ].map((item) => (
          <fieldset key={item.name} className="rounded-2xl border border-[#E8DED5] p-5">
            <legend className="px-2 font-semibold text-[#2B2B2B]">{item.question}</legend>
            <div className="mt-3 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-[#444]">
                <input type="radio" name={item.name} value="yes" required className="accent-[#7B2330]" />
                Да
              </label>
              <label className="flex items-center gap-2 text-[#444]">
                <input type="radio" name={item.name} value="no" required className="accent-[#7B2330]" />
                Нет
              </label>
            </div>
          </fieldset>
        ))}

        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-full bg-[#7B2330] px-8 py-5 text-lg font-semibold text-white transition hover:bg-[#641B25]"
        >
          Получить предварительную оценку
          <ArrowRight className="ml-3 h-5 w-5" />
        </button>

        {result ? (
          <div
            aria-live="polite"
            className={`rounded-3xl border p-7 ${
              result.kind === "discuss"
                ? "border-[#7B2330]/25 bg-[#7B2330]/5"
                : "border-[#C89A4A]/30 bg-[#C89A4A]/10"
            }`}
          >
            <h3 className="text-2xl font-bold text-[#2B2B2B]">{result.title}</h3>
            <p className="mt-4 leading-8 text-[#555]">{result.text}</p>
            <p className="mt-4 text-sm leading-6 text-[#666]">
              Предварительная оценка не подтверждает возможность или невозможность банкротства и не заменяет консультацию специалиста.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/contacts"
                className="inline-flex items-center rounded-full bg-[#7B2330] px-6 py-3 font-semibold text-white transition hover:bg-[#641B25]"
              >
                Обсудить ситуацию
              </Link>
              <button
                type="reset"
                className="inline-flex items-center rounded-full border border-[#D8CEC4] px-6 py-3 font-semibold text-[#444] transition hover:border-[#7B2330]"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Пройти заново
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
