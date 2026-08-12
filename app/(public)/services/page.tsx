import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Users,
  Scale,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Услуги",
  description:
    "Практикум, консультации и сопровождение процедуры банкротства физических лиц.",
  alternates: {
    canonical: "/services",
  },
};

const services = [
  {
    icon: BookOpen,
    title: "Практикум «Самосписание долгов»",
    description:
      "Полная пошаговая система самостоятельного прохождения процедуры банкротства физических лиц.",
    features: [
      "Пошаговые видеоуроки",
      "Шаблоны документов",
      "Автоматически заполненные формы",
      "Практические инструкции",
    ],
    button: "Подробнее",
    href: "/services/praktikum",
  },
  {
    icon: Users,
    title: "Индивидуальная консультация",
    description:
      "Разберём вашу ситуацию, оценим риски и подскажем наиболее безопасный вариант решения.",
    features: [
      "Анализ документов",
      "Оценка перспектив",
      "Ответы на вопросы",
      "План дальнейших действий",
    ],
    button: "Получить консультацию",
    href: "/contacts",
  },
  {
    icon: Scale,
    title: "Полное сопровождение",
    description:
      "Если вы не хотите заниматься процедурой самостоятельно, наши специалисты могут полностью сопровождать процесс.",
    features: [
      "Подготовка документов",
      "Представительство",
      "Контроль процедуры",
      "Юридическая поддержка",
    ],
    button: "Узнать подробнее",
    href: "/contacts",
  },
];

export default function ServicesPage() {
  return (
    <main className="bg-[#F7F5F2]">

      {/* Hero */}

      <section className="py-28">

        <div className="mx-auto max-w-7xl px-6">

          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            Наши услуги
          </span>

          <h1 className="mt-6 text-6xl font-bold leading-tight text-[#2B2B2B]">
            Выберите формат,
            <br />
            который подходит
            <br />
            именно вам.
          </h1>

          <p className="mt-10 max-w-3xl text-xl leading-9 text-[#666]">
            Кто-то хочет пройти процедуру самостоятельно,
            кому-то необходима консультация,
            а кому-то — полное юридическое сопровождение.
            Мы предлагаем решение для каждой ситуации.
          </p>

        </div>

      </section>

      {/* Карточки */}

      <section className="pb-28">

        <div className="mx-auto max-w-7xl px-6">

          <div className="grid gap-10 lg:grid-cols-3">

            {services.map((service) => {

              const Icon = service.icon;

              return (

                <div
                  key={service.title}
                  className="flex flex-col rounded-[36px] border border-[#E8DED5] bg-white p-10 shadow-xl transition hover:-translate-y-2 hover:shadow-2xl"
                >

                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7B2330]/10">

                    <Icon className="h-8 w-8 text-[#7B2330]" />

                  </div>

                  <h2 className="mt-8 text-3xl font-bold text-[#2B2B2B]">
                    {service.title}
                  </h2>

                  <p className="mt-6 leading-8 text-[#666]">
                    {service.description}
                  </p>

                  <div className="mt-8 space-y-4">

                    {service.features.map((feature) => (

                      <div
                        key={feature}
                        className="flex items-center gap-3"
                      >

                        <CheckCircle2 className="h-5 w-5 text-[#7B2330]" />

                        <span className="text-[#444]">
                          {feature}
                        </span>

                      </div>

                    ))}

                  </div>

                  <div className="mt-auto pt-10">

                    <Link
                      href={service.href}
                      className="inline-flex items-center rounded-full bg-[#7B2330] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[#641B25]"
                    >
                      {service.button}

                      <ArrowRight className="ml-3 h-5 w-5" />

                    </Link>

                  </div>

                </div>

              );

            })}

          </div>

        </div>

      </section>

    </main>
  );
}