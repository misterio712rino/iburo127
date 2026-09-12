"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const questions = [
  {
    question: "Что такое банкротство физического лица?",
    answer:
      "Банкротство — это законная процедура, позволяющая гражданину освободиться от непосильных долгов через суд.",
  },
  {
    question: "Какие долги можно списать?",
    answer:
      "В большинстве случаев списанию подлежат кредиты, микрозаймы, кредитные карты, задолженности перед банками и МФО.",
  },
  {
    question: "Можно ли пройти процедуру самостоятельно?",
    answer:
      "Да. Именно для этого создан наш практикум, который содержит видеоинструкции, шаблоны документов и пошаговый алгоритм действий.",
  },
  {
    question: "Сколько длится процедура?",
    answer:
      "В среднем процедура занимает от 6 до 12 месяцев в зависимости от конкретной ситуации.",
  },
  {
    question: "Можно ли сохранить имущество?",
    answer:
      "Все зависит от конкретной ситуации. Единственное жилье обычно не реализуется, однако существуют исключения, предусмотренные законодательством.",
  },
  {
    question: "Можно ли списать долги по микрозаймам?",
    answer:
      "Да. Если соблюдаются требования законодательства, задолженность перед МФО также может быть списана.",
  },
  {
    question: "Что будет после завершения процедуры?",
    answer:
      "После завершения процедуры гражданин освобождается от большинства долгов и начинает финансовую жизнь без прежней долговой нагрузки.",
  },
];

export default function FAQClient() {
  const [opened, setOpened] = useState(questions[0].question);

  return (
    <main className="bg-[#F7F5F2]">
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            FAQ
          </span>

          <h1 className="mt-6 text-6xl font-bold leading-tight text-[#2B2B2B]">
            Часто
            <br />
            задаваемые
            <br />
            вопросы
          </h1>

          <p className="mt-8 max-w-3xl text-xl leading-9 text-[#666]">
            Мы собрали ответы на самые популярные вопросы,
            которые возникают перед прохождением процедуры
            банкротства.
          </p>
        </div>
      </section>

      <section className="pb-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="space-y-5">
            {questions.map((item, index) => {
              const isOpen = opened === item.question;
              const answerId = `faq-answer-${index}`;

              return (
                <div
                  key={item.question}
                  className="rounded-3xl border border-[#E8DED5] bg-white p-6 shadow-lg"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    className="flex w-full items-center justify-between text-left"
                    onClick={() =>
                      setOpened(isOpen ? "" : item.question)
                    }
                  >
                    <span className="text-xl font-semibold text-[#2B2B2B]">
                      {item.question}
                    </span>

                    <ChevronDown
                      className={`transition duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <p id={answerId} className="mt-6 leading-8 text-[#666]">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
