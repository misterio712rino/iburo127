import Link from "next/link";
import { GraduationCap, MessagesSquare, Scale, Shield } from "lucide-react";

const services = [
  {
    title: "Практикум «Самосписание долгов»",
    description:
      "Пошаговая программа для тех, кто хочет самостоятельно пройти процедуру банкротства.",
    href: "/services/praktikum",
    buttonLabel: "Подробнее",
    icon: GraduationCap,
  },
  {
    title: "Банкротство физических лиц",
    description:
      "Полное сопровождение процедуры банкротства от анализа ситуации до завершения дела.",
    href: "/services/bankrotstvo-fizicheskih-lic",
    buttonLabel: "Подробнее",
    icon: Scale,
  },
  {
    title: "Защита от коллекторов",
    description:
      "Помогаем прекратить незаконное давление и защитить ваши права.",
    href: "/services/zashchita-ot-kollektorov",
    buttonLabel: "Подробнее",
    icon: Shield,
  },
  {
    title: "Бесплатная консультация",
    description:
      "Разберем вашу ситуацию и подскажем наиболее эффективный вариант решения.",
    href: "/contacts",
    buttonLabel: "Получить консультацию",
    icon: MessagesSquare,
  },
];

export default function Services() {
  return (
    <section id="services" aria-labelledby="services-title" className="px-6 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#a16207]">
            Услуги
          </p>
          <h2 id="services-title" className="text-3xl font-semibold leading-tight text-[#111111] sm:text-4xl">
            Наши решения
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#4b4b4b]">
            Мы предлагаем несколько форматов помощи. Выберите тот, который лучше всего подходит именно вашей ситуации.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {services.map((service) => {
            const Icon = service.icon;

            return (
              <article
                key={service.title}
                className="group flex h-full flex-col rounded-[1.75rem] border border-black/10 bg-white p-8 shadow-[0_18px_50px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(0,0,0,0.1)]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff3e6] text-[#ff8a00]">
                  <Icon className="h-7 w-7" />
                </div>

                <h3 className="mt-6 text-xl font-semibold text-[#111111]">{service.title}</h3>
                <p className="mt-4 flex-1 text-base leading-7 text-[#4b4b4b]">{service.description}</p>

                <Link
                  href={service.href}
                  className="mt-8 inline-flex w-fit items-center justify-center rounded-full bg-[#ff8a00] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#e67d00]"
                >
                  {service.buttonLabel}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
