"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  Scale,
  BookOpen,
  Users,
} from "lucide-react";

const items = [
  {
    icon: ShieldCheck,
    title: "Только законные решения",
    text: "Все материалы основаны на действующем законодательстве Российской Федерации и актуальной судебной практике.",
  },
  {
    icon: Scale,
    title: "Экономия десятков тысяч рублей",
    text: "Практикум позволяет самостоятельно пройти процедуру без дорогостоящего юридического сопровождения.",
  },
  {
    icon: BookOpen,
    title: "Полная пошаговая система",
    text: "От первой консультации до завершения процедуры — каждый этап подробно разобран простым языком.",
  },
  {
    icon: Users,
    title: "Поддержка специалистов",
    text: "Если во время прохождения процедуры возникают вопросы — вы всегда можете получить помощь.",
  },
];

export default function AboutCompany() {
  return (
    <section className="bg-[#F5F5F7] py-36">

      <div className="mx-auto max-w-7xl px-8">

        <div className="grid items-center gap-28 lg:grid-cols-2">

          {/* Левая колонка */}

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: .7 }}
            viewport={{ once: true }}
          >

            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7B2330]">
              О компании
            </span>

            <h2 className="mt-8 max-w-[620px] text-[58px] font-semibold leading-[1.02] tracking-[-0.05em] text-[#1D1D1F]">

              Мы не продаём
              <br />
              юридические услуги.

              <br />
              <br />

              Мы обучаем людей
              защищать себя.

            </h2>

            <p className="mt-12 max-w-[560px] text-[21px] leading-[2] text-[#6E6E73]">

              127PRO создан для людей, которые хотят пройти процедуру банкротства самостоятельно, понимая каждый свой шаг.

              <br />
              <br />

              Вместо сложных юридических терминов —
              понятные видеоуроки, шаблоны документов, автоматически заполненные формы и практические инструкции.

              <br />
              <br />

              Наша задача —
              сделать сложную юридическую процедуру максимально понятной, спокойной и безопасной.

            </p>

          </motion.div>

                    {/* Правая колонка */}

          <div className="space-y-6">

            {items.map((item, index) => {
              const Icon = item.icon;

              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 35 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.08,
                  }}
                  viewport={{ once: true }}
                  className="
                    group
                    rounded-[34px]
                    border
                    border-[#E5E5E7]
                    bg-white
                    p-9
                    transition-all
                    duration-500
                    hover:-translate-y-2
                    hover:border-[#D5C5B6]
                    hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)]
                  "
                >

                  <div className="flex items-start gap-7">

                    <div
                      className="
                        flex
                        h-16
                        w-16
                        shrink-0
                        items-center
                        justify-center
                        rounded-2xl
                        bg-[#F5F5F7]
                        transition-all
                        duration-500
                        group-hover:bg-[#7B2330]
                      "
                    >

                      <Icon
                        className="
                          h-8
                          w-8
                          text-[#7B2330]
                          transition-colors
                          duration-500
                          group-hover:text-white
                        "
                      />

                    </div>

                    <div>

                      <h3
                        className="
                          text-[26px]
                          font-semibold
                          tracking-[-0.03em]
                          text-[#1D1D1F]
                        "
                      >
                        {item.title}
                      </h3>

                      <p
                        className="
                          mt-4
                          max-w-[430px]
                          text-[17px]
                          leading-8
                          text-[#6E6E73]
                        "
                      >
                        {item.text}
                      </p>

                    </div>

                  </div>

                </motion.div>
              );
            })}

          </div>

        </div>

      </div>

    </section>
  );
}