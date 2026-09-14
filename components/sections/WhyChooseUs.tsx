"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  Scale,
  BookOpen,
} from "lucide-react";

const cards = [
  {
    icon: BookOpen,
    title: "Понятно каждому",
    text:
      "Мы объясняем сложную юридическую процедуру простым человеческим языком. Каждый этап становится понятным.",
  },
  {
    icon: Scale,
    title: "Полностью законно",
    text:
      "Практикум построен на Федеральном законе №127-ФЗ и актуальной судебной практике Российской Федерации.",
  },
  {
    icon: ShieldCheck,
    title: "Без лишних расходов",
    text:
      "Вы проходите процедуру самостоятельно и экономите десятки тысяч рублей на юридическом сопровождении.",
  },
];

export default function WhyChooseUs() {
  return (
    <section className="bg-[#F5F5F7] py-36">

      <div className="mx-auto max-w-7xl px-8">

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: .8 }}
          className="max-w-5xl"
        >

          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            Почему iБюро
          </span>

          <h2
            className="
              mt-8
              text-[54px]
              font-semibold
              leading-[1.02]
              tracking-[-0.05em]
              text-[#1D1D1F]
              lg:text-[76px]
            "
          >
            Тысячи людей выбирают
            <br />
            самостоятельное
            <br />
            банкротство.
          </h2>

          <p
            className="
              mt-10
              max-w-3xl
              text-[22px]
              leading-10
              text-[#6E6E73]
            "
          >
            Мы создали систему,
            которая помогает человеку пройти процедуру спокойно,
            понимая каждый свой шаг.
          </p>

        </motion.div>

        <motion.div
  initial={{ opacity: 0, y: 40 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: .8, delay: .15 }}
  className="mt-24 grid gap-8 lg:grid-cols-3"
>

  {cards.map((card, index) => {
    const Icon = card.icon;

    return (
      <motion.div
        key={card.title}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{
          duration: .6,
          delay: index * .12,
        }}
        className="
          group
          rounded-[34px]
          border
          border-[#E5E5E7]
          bg-white
          p-10
          shadow-[0_20px_50px_rgba(0,0,0,0.04)]
          transition-all
          duration-500
          hover:-translate-y-2
          hover:shadow-[0_35px_80px_rgba(0,0,0,0.10)]
        "
      >

        <div
          className="
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-2xl
            bg-[#7B2330]/8
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

        <h3
          className="
            mt-10
            text-[30px]
            font-semibold
            tracking-[-0.03em]
            text-[#1D1D1F]
          "
        >
          {card.title}
        </h3>

        <p
          className="
            mt-6
            text-[18px]
            leading-9
            text-[#6E6E73]
          "
        >
          {card.text}
        </p>

      </motion.div>
    );
  })}

</motion.div>


      </div>

    </section>
  );
}