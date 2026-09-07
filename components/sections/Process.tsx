import {
  CircleCheckBig,
  ClipboardCheck,
  FileSearch,
  PhoneCall,
  Scale,
} from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Первичная консультация",
    description:
      "Изучаем вашу ситуацию, отвечаем на вопросы и определяем возможные варианты решения.",
    icon: PhoneCall,
  },
  {
    number: "02",
    title: "Анализ документов",
    description:
      "Проверяем документы, оцениваем риски и подготавливаем дальнейший план действий.",
    icon: FileSearch,
  },
  {
    number: "03",
    title: "Подбор решения",
    description:
      "Предлагаем наиболее подходящий формат помощи: практикум, консультацию или сопровождение.",
    icon: ClipboardCheck,
  },
  {
    number: "04",
    title: "Работа по вашему делу",
    description:
      "Помогаем пройти все этапы процедуры максимально спокойно и безопасно.",
    icon: Scale,
  },
  {
    number: "05",
    title: "Результат",
    description:
      "Вы получаете законное решение своей финансовой ситуации и дальнейшие рекомендации.",
    icon: CircleCheckBig,
  },
];

export default function Process() {
  return (
    <section id="process" aria-labelledby="process-title" className="px-6 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#a16207]">
            Как проходит работа
          </p>
          <h2 id="process-title" className="text-3xl font-semibold leading-tight text-[#111111] sm:text-4xl">
            Мы сопровождаем клиента на каждом этапе — от первого обращения до решения вопроса.
          </h2>
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute left-0 right-0 top-12 h-px bg-gradient-to-r from-[#ff8a00]/20 via-[#ff8a00]/60 to-[#ff8a00]/20" />

          <div className="grid gap-6 lg:grid-cols-5">
            {steps.map((step) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.number}
                  className="group relative rounded-[1.75rem] border border-black/10 bg-[#fffaf2] p-7 shadow-[0_16px_50px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_65px_rgba(0,0,0,0.1)]"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff3e6] text-[#ff8a00]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-4xl font-semibold tracking-[0.08em] text-[#111111]/20">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold text-[#111111]">{step.title}</h3>
                  <p className="mt-3 text-base leading-7 text-[#4b4b4b]">{step.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
