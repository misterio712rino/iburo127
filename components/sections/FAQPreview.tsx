"use client";

import Link from "next/link";
import { ChevronDown, ArrowRight } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    question: "Что такое банкротство физического лица?",
    answer:
      "Банкротство физического лица — это законная процедура, позволяющая гражданину списать долги, если он объективно не способен исполнять свои обязательства. Процедура регулируется Федеральным законом №127-ФЗ.",
  },
  {
    question: "Можно ли пройти процедуру самостоятельно?",
    answer:
      "Да. Именно для этого мы создали практикум. Вы получите пошаговые видеоинструкции, шаблоны документов, автоматически заполненные формы и подробные инструкции для каждого этапа процедуры.",
  },
  {
    question: "Какие долги можно списать?",
    answer:
      "Как правило, списанию подлежат кредиты, микрозаймы, кредитные карты, налоговые задолженности, долги перед физическими лицами и другие обязательства, если они соответствуют требованиям законодательства.",
  },
  {
    question: "Сколько длится процедура?",
    answer:
      "Средний срок прохождения процедуры составляет от 6 до 12 месяцев. Продолжительность зависит от конкретной ситуации, состава имущества и количества кредиторов.",
  },
  {
    question: "Можно ли сохранить имущество?",
    answer:
      "Во многих случаях часть имущества защищена законом и не подлежит реализации. Каждый случай индивидуален, поэтому перед началом процедуры важно провести анализ вашей ситуации.",
  },
  {
    question: "Нужен ли юрист?",
    answer:
      "Нет. Практикум разработан таким образом, чтобы человек смог пройти процедуру самостоятельно. При необходимости вы всегда сможете получить дополнительную консультацию.",
  },
];

export default function FAQPreview() {
  const [openQuestion, setOpenQuestion] = useState(0);

  return (
    <section className="bg-[#F7F5F2] py-28">

      <div className="mx-auto max-w-7xl px-6">

        <div className="mx-auto mb-16 max-w-3xl text-center">

          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7B2330]">
            Частые вопросы
          </span>

          <h2 className="mt-6 text-5xl font-bold leading-tight text-[#2B2B2B]">
            Всё, что важно знать
            <br />
            перед началом процедуры.
          </h2>

          <p className="mt-8 text-xl leading-9 text-[#666]">
            Мы собрали ответы на вопросы,
            которые нам задают чаще всего.
          </p>

        </div>

        <div className="mx-auto max-w-5xl space-y-5">

          {faqs.map((item, index) => {

            const isOpen = openQuestion === index;
            const answerId = `faq-preview-answer-${index}`;

            return (

              <div
                key={item.question}
                className="overflow-hidden rounded-[28px] border border-[#E8DED5] bg-white shadow-lg"
              >

                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() =>
                    setOpenQuestion(isOpen ? -1 : index)
                  }
                  className="flex w-full items-center justify-between p-8 text-left transition hover:bg-[#FAF8F5]"
                >

                  <h3 className="text-xl font-semibold text-[#2B2B2B]">
                    {item.question}
                  </h3>

                  <ChevronDown
                    className={`h-6 w-6 text-[#7B2330] transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />

                </button>

                <div
                  id={answerId}
                  className={`grid transition-all duration-300 ${
                    isOpen
                      ? "grid-rows-[1fr]"
                      : "grid-rows-[0fr]"
                  }`}
                >

                  <div className="overflow-hidden">

                    <div className="border-t border-[#ECE3D8] px-8 py-6">

                      <p className="text-lg leading-9 text-[#666]">
                        {item.answer}
                      </p>

                    </div>

                  </div>

                </div>

              </div>

            );

          })}

        </div>

        <div className="mt-16 flex justify-center">

          <Link
            href="/faq"
            className="inline-flex items-center rounded-full bg-[#7B2330] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[#641B25]"
          >

            Смотреть все вопросы

            <ArrowRight className="ml-3 h-5 w-5" />

          </Link>

        </div>

      </div>

    </section>
  );
}
