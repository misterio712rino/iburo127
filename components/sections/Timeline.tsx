const steps = [
  {
    title: "Шаг 1: Изучение теории",
    text: "Смотрите видеоуроки, изучаете законы и процедуру, заполняете рабочую тетрадь.",
  },
  {
    title: "Шаг 2: Подготовка документов",
    text: "Выполняете практические задания: собираете документы, готовите заявление в суд.",
  },
  {
    title: "Шаг 3: Запуск процедуры",
    text: "Подаёте документы в суд. Начинаете процедуру реструктуризации или реализации имущества.",
  },
  {
    title: "Шаг 4: Сопровождение на практике",
    text: "Проходите процедуру с поддержкой курса: участвуете в заседаниях, работаете с управляющим.",
  },
  {
    title: "Шаг 5: Завершение — списание долгов",
    text: "Получаете определение суда об освобождении от долгов. Начинаете жизнь без финансового бремени.",
  },
];

export default function Timeline() {
  return (
    <section className="px-6 py-28 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-black/10 bg-white p-8 lg:p-12">
        <div className="mb-10 max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#a16207]">
            Как проходит практикум
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-[#111111] sm:text-4xl">
            Пошаговая система обучения с проверкой и поддержкой.
          </h2>
        </div>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <article key={step.title} className="flex gap-4 rounded-[1.25rem] border border-black/10 bg-[#f8f7f3] p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ff8a00] text-lg font-semibold text-white">
                {index + 1}
              </div>
              <div>
                <h3 className="mb-2 text-xl font-semibold text-[#111111]">{step.title}</h3>
                <p className="text-base leading-7 text-[#4b4b4b]">{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
