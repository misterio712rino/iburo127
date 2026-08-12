"use client";

import {
  ShieldCheck,
  Lock,
  FileCheck,
  Headphones,
} from "lucide-react";

const guarantees = [
  {
    icon: ShieldCheck,
    title: "Полностью законно",
    text: "Практикум построен на действующем законодательстве Российской Федерации и актуальной судебной практике.",
  },
  {
    icon: Lock,
    title: "Конфиденциальность",
    text: "Ваша информация остаётся только между вами и нашей системой.",
  },
  {
    icon: FileCheck,
    title: "Готовые документы",
    text: "Все шаблоны регулярно обновляются в соответствии с законодательством.",
  },
  {
    icon: Headphones,
    title: "Поддержка",
    text: "Если возникнут вопросы, вы всегда сможете получить помощь специалистов.",
  },
];

export default function Guarantees() {
  return (
    <section className="relative overflow-hidden bg-[#F7F5F2] py-32">

      {/* Background */}

      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#F7F5F2] to-[#F2EEE8]" />

      <div className="absolute left-1/2 top-0 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-white opacity-60 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6">

        <div className="mx-auto max-w-4xl text-center">

          <span className="inline-flex rounded-full border border-[#E6DDD3] bg-white px-5 py-2 text-sm font-semibold uppercase tracking-[0.30em] text-[#7B2330]">
            Ваши гарантии
          </span>

          <h2 className="mt-8 text-5xl font-bold tracking-[-0.04em] text-[#1D1D1F] lg:text-6xl">
            Спокойствие
            <br />
            на каждом этапе
          </h2>

          <p className="mx-auto mt-8 max-w-3xl text-xl leading-9 text-[#666]">
            Мы сделали всё, чтобы прохождение процедуры было
            максимально понятным, безопасным и комфортным.
          </p>

        </div>

        <div className="mt-24 grid gap-8 md:grid-cols-2">

  {guarantees.map((item) => {

    const Icon = item.icon;

    return (

      <div
        key={item.title}
        className="
          group
          relative
          overflow-hidden
          rounded-[34px]
          border
          border-white/70
          bg-white/70
          p-10
          backdrop-blur-xl
          shadow-[0_20px_60px_rgba(0,0,0,0.06)]
          transition-all
          duration-500
          hover:-translate-y-3
          hover:shadow-[0_35px_90px_rgba(0,0,0,0.12)]
        "
      >

        <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-[#7B2330]/5 blur-3xl transition duration-500 group-hover:bg-[#7B2330]/10" />

        <div className="relative">

          <div
            className="
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-2xl
              bg-[#7B2330]/10
              transition-all
              duration-500
              group-hover:scale-110
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

          <h3 className="mt-8 text-3xl font-bold tracking-[-0.03em] text-[#1D1D1F]">

            {item.title}

          </h3>

          <p className="mt-6 text-[18px] leading-9 text-[#666]">

            {item.text}

          </p>

        </div>

      </div>

    );

  })}

</div>

<div className="mt-24 overflow-hidden rounded-[42px] bg-gradient-to-br from-[#7B2330] via-[#64202A] to-[#3A161D] p-14 shadow-[0_40px_120px_rgba(0,0,0,0.18)]">

  <div className="grid items-center gap-12 lg:grid-cols-[1.3fr_0.7fr]">

    <div>

      <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold uppercase tracking-[0.30em] text-[#F4D59A]">
        Наша философия
      </span>

      <h3 className="mt-8 text-5xl font-bold leading-tight tracking-[-0.04em] text-white">
        Мы помогаем людям
        <br />
        вернуть спокойствие.
      </h3>

      <p className="mt-8 max-w-2xl text-xl leading-9 text-white/80">
        Практикум создан не просто для подготовки документов.
        Его задача — дать человеку понимание процесса, уверенность
        в каждом шаге и возможность самостоятельно решить проблему
        без дорогостоящих юридических услуг.
      </p>

    </div>

    <div className="grid gap-6">

      <div className="rounded-3xl bg-white/10 p-8 backdrop-blur">

        <div className="text-5xl font-bold text-white">
          100%
        </div>

        <p className="mt-3 text-white/70">
          Законный процесс
        </p>

      </div>

      <div className="rounded-3xl bg-white/10 p-8 backdrop-blur">

        <div className="text-5xl font-bold text-white">
          90 дней
        </div>

        <p className="mt-3 text-white/70">
          Доступ к практикуму
        </p>

      </div>

    </div>

  </div>

</div>

      </div>

    </section>

  );
}