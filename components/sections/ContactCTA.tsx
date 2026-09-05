import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  PhoneCall,
  FileCheck2,
  Scale,
} from "lucide-react";

export default function ContactCTA() {
  return (
    <section className="bg-[#F7F5F2] py-28">

      <div className="mx-auto max-w-7xl px-6">

        <div className="overflow-hidden rounded-[42px] bg-[#111111] shadow-2xl">

          <div className="grid lg:grid-cols-2">

            {/* Левая колонка */}

            <div className="p-12 lg:p-16">

              <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#C89A4A]">
                Бесплатная консультация
              </span>

              <h2 className="mt-6 text-5xl font-bold leading-tight text-white">
                Не знаете,
                <br />
                подходит ли вам
                <br />
                банкротство?
              </h2>

              <p className="mt-8 text-xl leading-9 text-white/70">
                Мы бесплатно проанализируем вашу ситуацию,
                ответим на все вопросы и подскажем,
                какой вариант решения будет наиболее
                безопасным именно для вас.
              </p>

              <div className="mt-12 flex flex-wrap gap-5">

                <Link
                  href="/contacts"
                  className="inline-flex items-center rounded-full bg-[#7B2330] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[#641B25]"
                >
                  Получить консультацию
                </Link>

                <Link
                  href="/bankruptcy-check"
                  className="inline-flex items-center rounded-full border border-white/20 px-8 py-4 text-lg font-semibold text-white transition hover:bg-white/10"
                >
                  Проверить возможность

                  <ArrowRight className="ml-3 h-5 w-5" />

                </Link>

              </div>

            </div>

            {/* Правая колонка */}

            <div className="bg-[#181818] p-12 lg:p-16">

              <h3 className="text-3xl font-bold text-white">
                Что вы получите?
              </h3>

              <div className="mt-10 space-y-6">

                <div className="flex items-start gap-5 rounded-3xl bg-white/5 p-6">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7B2330]/20">

                    <PhoneCall className="h-7 w-7 text-[#C89A4A]" />

                  </div>

                  <div>

                    <h4 className="text-xl font-semibold text-white">
                      Бесплатную консультацию
                    </h4>

                    <p className="mt-2 leading-8 text-white/70">
                      Разберём вашу ситуацию и ответим
                      на все интересующие вопросы.
                    </p>

                  </div>

                </div>

                <div className="flex items-start gap-5 rounded-3xl bg-white/5 p-6">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7B2330]/20">

                    <FileCheck2 className="h-7 w-7 text-[#C89A4A]" />

                  </div>

                  <div>

                    <h4 className="text-xl font-semibold text-white">
                      Анализ вашей ситуации
                    </h4>

                    <p className="mt-2 leading-8 text-white/70">
                      Проверим возможность списания долгов
                      именно в вашем случае.
                    </p>

                  </div>

                </div>

                <div className="flex items-start gap-5 rounded-3xl bg-white/5 p-6">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7B2330]/20">

                    <Scale className="h-7 w-7 text-[#C89A4A]" />

                  </div>

                  <div>

                    <h4 className="text-xl font-semibold text-white">
                      Законный план действий
                    </h4>

                    <p className="mt-2 leading-8 text-white/70">
                      Подскажем оптимальный путь решения
                      без навязывания лишних услуг.
                    </p>

                  </div>

                </div>

                <div className="flex items-start gap-5 rounded-3xl bg-white/5 p-6">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7B2330]/20">

                    <ShieldCheck className="h-7 w-7 text-[#C89A4A]" />

                  </div>

                  <div>

                    <h4 className="text-xl font-semibold text-white">
                      Полную конфиденциальность
                    </h4>

                    <p className="mt-2 leading-8 text-white/70">
                      Все обращения остаются строго
                      конфиденциальными.
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}