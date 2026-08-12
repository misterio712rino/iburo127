import type { Metadata } from "next";
import { Star, Quote } from "lucide-react";

export const metadata: Metadata = {
  title: "Отзывы",
  description:
    "Отзывы клиентов о практикуме и сопровождении процедуры банкротства.",
  alternates: {
    canonical: "/reviews",
  },
};

const reviews = [
  {
    name: "Александр",
    city: "Казань",
    text: "Благодаря практикуму смог самостоятельно разобраться в процедуре и избежать лишних расходов на юристов. Всё оказалось намного понятнее, чем я ожидал.",
  },
  {
    name: "Ирина",
    city: "Москва",
    text: "Очень понравилось, что информация подается простым языком. Каждый этап подробно объясняется, поэтому не возникает ощущения неизвестности.",
  },
  {
    name: "Дмитрий",
    city: "Санкт-Петербург",
    text: "После первой консультации понял, что ситуация не безвыходная. Получил четкий план действий и уверенность в своих дальнейших шагах.",
  },
  {
    name: "Елена",
    city: "Самара",
    text: "Практикум действительно экономит огромное количество времени. Документы уже подготовлены, остается только следовать инструкции.",
  },
  {
    name: "Максим",
    city: "Екатеринбург",
    text: "Самое ценное — отсутствие сложных юридических терминов. Всё объясняется так, что становится понятно даже человеку без опыта.",
  },
  {
    name: "Ольга",
    city: "Новосибирск",
    text: "Очень благодарна за системный подход. Каждый следующий шаг становится очевидным, а процедура больше не кажется страшной.",
  },
];

export default function ReviewsPage() {
  return (
    <main className="bg-[#F7F5F2]">

      <section className="py-24">

        <div className="mx-auto max-w-7xl px-6">

          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            Отзывы клиентов
          </span>

          <h1 className="mt-6 text-6xl font-bold leading-tight text-[#2B2B2B]">
            Люди,
            <br />
            которые уже решили
            <br />
            свою проблему
          </h1>

          <p className="mt-8 max-w-3xl text-xl leading-9 text-[#666]">
            Самая лучшая оценка нашей работы —
            это реальные истории людей,
            которые смогли спокойно пройти процедуру
            банкротства.
          </p>

        </div>

      </section>

      <section className="pb-28">

        <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-2 xl:grid-cols-3">

          {reviews.map((review) => (

            <article
              key={review.name}
              className="rounded-[36px] border border-[#E8DED5] bg-white p-8 shadow-lg transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
            >

              <Quote className="h-10 w-10 text-[#C89A4A]" />

              <div className="mt-6 flex gap-1">

                {Array.from({ length: 5 }).map((_, i) => (

                  <Star
                    key={i}
                    className="h-5 w-5 fill-[#C89A4A] text-[#C89A4A]"
                  />

                ))}

              </div>

              <p className="mt-8 leading-8 text-[#555]">
                {"\""}{review.text}{"\""}
              </p>

              <div className="mt-10 border-t border-[#ECE4D8] pt-6">

                <h3 className="text-xl font-bold text-[#2B2B2B]">
                  {review.name}
                </h3>

                <p className="mt-1 text-[#777]">
                  {review.city}
                </p>

              </div>

            </article>

          ))}

        </div>

      </section>

    </main>
  );
}
