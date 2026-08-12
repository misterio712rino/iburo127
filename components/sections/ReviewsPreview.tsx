import Link from "next/link";
import { Star, ArrowRight } from "lucide-react";

const reviews = [
  {
    name: "Александр",
    city: "Казань",
    text: "До знакомства с практикумом я был уверен, что самостоятельно пройти процедуру невозможно. После первого же модуля всё стало понятно. Каждый шаг расписан, документы подготовлены, а самое главное — исчез страх совершить ошибку.",
  },
  {
    name: "Ирина",
    city: "Москва",
    text: "Очень понравилось, что всё объясняется простым языком. Не пришлось искать информацию по десяткам сайтов. Практикум действительно ведет за руку от начала и до конца процедуры.",
  },
  {
    name: "Дмитрий",
    city: "Санкт-Петербург",
    text: "Я долго откладывал банкротство из-за страха перед судами и документами. Благодаря практикуму понял, что всё намного проще, чем казалось. Сейчас жалею только о том, что не начал раньше.",
  },
];

export default function ReviewsPreview() {
  return (
    <section
      id="reviews"
      className="bg-white py-28"
    >
      <div className="mx-auto max-w-7xl px-6">

        {/* Заголовок */}

        <div className="mx-auto max-w-3xl text-center">

          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            Отзывы клиентов
          </span>

          <h2 className="mt-6 text-5xl font-bold leading-tight text-[#2B2B2B]">
            Нам доверяют люди,
            <br />
            которые уже решили
            <br />
            проблему с долгами.
          </h2>

          <p className="mt-8 text-xl leading-9 text-[#666]">
            Каждый отзыв — это история человека,
            который смог разобраться в своей ситуации
            и начал новую финансовую жизнь.
          </p>

        </div>

        {/* Карточки */}

        <div className="mt-20 grid gap-8 lg:grid-cols-3">

          {reviews.map((review) => (

            <article
              key={review.name}
              className="rounded-[32px] border border-[#ECE3D8] bg-[#FDFBF8] p-10 shadow-lg transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
            >

              <div className="flex items-center gap-4">

                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#7B2330] text-xl font-bold text-white">
                  {review.name[0]}
                </div>

                <div>

                  <h3 className="text-xl font-semibold text-[#2B2B2B]">
                    {review.name}
                  </h3>

                  <p className="text-[#777]">
                    {review.city}
                  </p>

                </div>

              </div>

              <div className="mt-6 flex gap-1">

                {Array.from({ length: 5 }).map((_, index) => (

                  <Star
                    key={index}
                    className="h-5 w-5 fill-[#C89A4A] text-[#C89A4A]"
                  />

                ))}

              </div>

              <p className="mt-8 text-lg italic leading-9 text-[#555]">
                {"\""}{review.text}{"\""}
              </p>

            </article>

          ))}

        </div>

        {/* Кнопка */}

        <div className="mt-16 flex justify-center">

          <Link
            href="/reviews"
            className="inline-flex items-center rounded-full bg-[#7B2330] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[#641B25]"
          >
            Смотреть все отзывы

            <ArrowRight className="ml-3 h-5 w-5" />

          </Link>

        </div>

      </div>
    </section>
  );
}
