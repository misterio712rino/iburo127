"use client";

import { useState } from "react";
import {
  Star,
  Quote,
  ChevronRight,
} from "lucide-react";

const reviews = [
  {
    name: "Анна",
    city: "Москва",
    tariff: "PRO",
    rating: 5,
    text:
      "Было почти 900 000 ₽ долгов. Благодаря практикуму смогла пройти процедуру самостоятельно. Через семь месяцев получила полное списание долгов. Всё оказалось гораздо понятнее, чем рассказывали юристы.",
  },
  {
    name: "Дмитрий",
    city: "Краснодар",
    tariff: "ЭКСКЛЮЗИВ",
    rating: 5,
    text:
      "После прохождения практикума открыл собственное направление по сопровождению банкротства. Уже первые клиенты полностью окупили стоимость обучения.",
  },
  {
    name: "Елена",
    city: "Екатеринбург",
    tariff: "LIGHT",
    rating: 5,
    text:
      "Самое ценное — пошаговая система. Больше не было страха сделать что-то неправильно. Каждый этап подробно объясняется простым языком.",
  },
  {
    name: "Игорь",
    city: "Казань",
    tariff: "PRO",
    rating: 5,
    text:
      "Практикум позволил пройти процедуру без дорогостоящего юридического сопровождения. Огромная экономия денег и времени.",
  },
  {
    name: "Марина",
    city: "Самара",
    tariff: "LIGHT",
    rating: 5,
    text:
      "Очень понравилась структура курса. Документы уже готовы, остаётся только следовать инструкции.",
  },
  {
    name: "Сергей",
    city: "Санкт-Петербург",
    tariff: "ЭКСКЛЮЗИВ",
    rating: 5,
    text:
      "Поддержка действительно работает. На все вопросы отвечали быстро, благодаря чему процедура прошла спокойно.",
  },
];

export default function Reviews() {
  const [activeCard, setActiveCard] = useState<number | null>(null);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#F7F5F2] via-white to-[#F7F5F2] py-32">

      {/* фон */}

      <div className="absolute inset-0">

        <div className="absolute left-1/2 top-0 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-[#7B2330]/5 blur-[170px]" />

      </div>

      <div className="relative mx-auto max-w-7xl px-6">

        {/* заголовок */}

        <div className="mx-auto max-w-5xl text-center">

          <span className="inline-flex rounded-full border border-[#E8DED5] bg-white px-5 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            Отзывы
          </span>

          <h2 className="mt-8 text-5xl font-bold tracking-[-0.05em] text-[#1D1D1F] lg:text-6xl">
            Люди,
            <br />
            которые уже изменили
            <br />
            свою финансовую жизнь
          </h2>

          <p className="mx-auto mt-8 max-w-3xl text-xl leading-9 text-[#666]">
            Настоящие истории наших учеников, которые самостоятельно
            прошли процедуру банкротства и начали новую жизнь без долгов.
          </p>

        </div>

        {/* статистика */}

        <div className="mt-24 grid gap-8 rounded-[38px] border border-[#ECE4DA] bg-white p-10 shadow-[0_30px_80px_rgba(0,0,0,0.07)] md:grid-cols-3">

          <div className="text-center">

            <div className="mb-5 flex justify-center gap-1">

              {Array.from({ length: 5 }).map((_, index) => (

                <Star
                  key={index}
                  className="h-6 w-6 fill-[#C89A4A] text-[#C89A4A]"
                />

              ))}

            </div>

            <div className="text-5xl font-bold tracking-[-0.05em] text-[#1D1D1F]">
              4.9
            </div>

            <div className="mt-2 text-[#666]">
              Средняя оценка
            </div>

          </div>

          <div className="text-center">

            <div className="text-5xl font-bold tracking-[-0.05em] text-[#1D1D1F]">
              500+
            </div>

            <div className="mt-2 text-[#666]">
              Выпускников
            </div>

          </div>

          <div className="text-center">

            <div className="text-5xl font-bold tracking-[-0.05em] text-[#1D1D1F]">
              98%
            </div>

            <div className="mt-2 text-[#666]">
              Успешных процедур
            </div>

          </div>

        </div>

        {/* карточки */}

        <div className="mt-24 grid gap-8 lg:grid-cols-3">
                    {reviews.map((review, index) => {

            const dimmed =
              activeCard !== null && activeCard !== index;

            return (

              <article
                key={`${review.name}-${index}`}
                onMouseEnter={() => setActiveCard(index)}
                onMouseLeave={() => setActiveCard(null)}
                className={`
                  group
                  relative
                  overflow-hidden
                  rounded-[34px]
                  border
                  border-[#E9E2D8]
                  bg-white
                  p-9
                  transition-all
                  duration-500
                  ease-out

                  ${
                    activeCard === index
                      ? "scale-[1.05] -translate-y-4 shadow-[0_45px_120px_rgba(0,0,0,0.18)] z-20"
                      : ""
                  }

                  ${
                    dimmed
                      ? "scale-[0.96] opacity-60 blur-[1px]"
                      : "shadow-[0_18px_45px_rgba(0,0,0,0.06)]"
                  }
                `}
              >

                {/* Декоративная кавычка */}

                <div className="absolute right-8 top-8 opacity-10 transition duration-500 group-hover:opacity-20">

                  <Quote className="h-20 w-20 text-[#7B2330]" />

                </div>

                {/* Рейтинг */}

                <div className="mb-8 flex gap-1">

                  {Array.from({ length: review.rating }).map((_, i) => (

                    <Star
                      key={i}
                      className="h-5 w-5 fill-[#C89A4A] text-[#C89A4A]"
                    />

                  ))}

                </div>

                {/* Отзыв */}

                <p className="text-[17px] leading-9 text-[#555]">
                  {review.text}
                </p>

                {/* Автор */}

                <div className="mt-10 border-t border-[#EFE7DE] pt-7">

                  <div className="flex items-center justify-between">

                    <div>

                      <h3 className="text-xl font-bold text-[#1D1D1F]">
                        {review.name}
                      </h3>

                      <p className="mt-1 text-[#777]">
                        {review.city}
                      </p>

                    </div>

                    <div className="rounded-full bg-[#7B2330]/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#7B2330]">
                      {review.tariff}
                    </div>

                  </div>

                </div>

              </article>

            );

          })}
                  </div>

        {/* Нижний блок */}

        <div className="mt-24 overflow-hidden rounded-[38px] bg-gradient-to-r from-[#7B2330] via-[#6B1F2A] to-[#3B1C21] p-14 shadow-[0_35px_90px_rgba(123,35,48,0.28)]">

          <div className="grid items-center gap-10 lg:grid-cols-[2fr_auto]">

            <div>

              <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#E7C98A]">
                Присоединяйтесь
              </span>

              <h3 className="mt-5 text-4xl font-bold leading-tight text-white">
                Следующий успешный отзыв
                <br />
                может быть именно вашим.
              </h3>

              <p className="mt-6 max-w-3xl text-lg leading-9 text-white/80">
                Мы создали практикум, который помогает пройти процедуру
                самостоятельно, законно и без переплаты за дорогостоящее
                юридическое сопровождение.
              </p>

            </div>

            <div>

              <a
                href="#price"
                className="
                  inline-flex
                  items-center
                  justify-center
                  rounded-full
                  bg-white
                  px-10
                  py-5
                  text-lg
                  font-semibold
                  text-[#7B2330]
                  transition-all
                  duration-300
                  hover:scale-105
                  hover:shadow-2xl
                "
              >
                Выбрать тариф

                <ChevronRight className="ml-3 h-5 w-5" />

              </a>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}