import type { Metadata } from "next";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Контакты",
  description: "Свяжитесь с нами любым удобным способом.",
  alternates: {
    canonical: "/contacts",
  },
};

export default function ContactsPage() {
  return (
    <main className="bg-[#F7F5F2]">
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            Контакты
          </span>

          <h1 className="mt-6 text-6xl font-bold leading-tight text-[#2B2B2B]">
            Свяжитесь
            <br />
            с нами
          </h1>

          <p className="mt-8 max-w-3xl text-xl leading-9 text-[#666]">
            Если у вас возникли вопросы или вы хотите понять,
            подходит ли вам процедура банкротства —
            просто напишите нам.
          </p>
        </div>
      </section>

      <section className="pb-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-2">
          {/* Левая колонка */}

          <div className="rounded-[36px] border border-[#E8DED5] bg-white p-10 shadow-xl">
            <h2 className="text-3xl font-bold text-[#2B2B2B]">
              Наши контакты
            </h2>

            <div className="mt-10 space-y-8">
              <div className="flex gap-5">
                <Phone className="h-7 w-7 text-[#7B2330]" />

                <div>
                  <p className="font-semibold">
                    Телефоны
                  </p>

                  <p className="text-[#666]">
                    +7 (843) 214-56-40
                  </p>

                  <p className="text-[#666]">
                    +7 (952) 039-78-84
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <Mail className="h-7 w-7 text-[#7B2330]" />

                <div>
                  <p className="font-semibold">
                    Электронная почта
                  </p>

                  <p className="text-[#666]">
                    127pro@mail.ru
                  </p>

                  <p className="text-[#666]">
                    SRO.GAU@mail.ru
                  </p>

                  <p className="text-[#666]">
                    Bconsalt@internet.ru
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <MessageCircle className="h-7 w-7 text-[#7B2330]" />

                <div>
                  <p className="font-semibold">
                    Telegram
                  </p>

                  <p className="text-[#666]">
                    @iburo127
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <MapPin className="h-7 w-7 text-[#7B2330]" />

                <div>
                  <p className="font-semibold">
                    Адрес
                  </p>

                  <p className="text-[#666]">
                    г. Казань
                  </p>
                </div>
              </div>

              <div className="flex gap-5">
                <Clock className="h-7 w-7 text-[#7B2330]" />

                <div>
                  <p className="font-semibold">
                    Режим работы
                  </p>

                  <p className="text-[#666]">
                    Пн–Пт • 09:00–18:00
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Правая колонка */}

          <div className="rounded-[36px] border border-[#E8DED5] bg-white p-10 shadow-xl">
            <h2 className="text-3xl font-bold text-[#2B2B2B]">
              Напишите нам
            </h2>

            <p className="mt-4 text-[#666] leading-8">
              Оставьте сообщение, и мы свяжемся с вами
              в ближайшее время.
            </p>

            <form className="mt-10 space-y-6">
              <input
                type="text"
                placeholder="Ваше имя"
                className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
              />

              <input
                type="tel"
                placeholder="Телефон"
                className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
              />

              <input
                type="email"
                placeholder="Email"
                className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
              />

              <textarea
                rows={6}
                placeholder="Ваш вопрос..."
                className="w-full rounded-2xl border border-[#E8DED5] px-5 py-4 outline-none transition focus:border-[#7B2330]"
              />

              <button
                className="w-full rounded-full bg-[#7B2330] py-4 text-lg font-semibold text-white transition hover:bg-[#641B25]"
              >
                Отправить сообщение
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}