const formats = [
  {
    title: "Видеоуроки",
    text: "Наглядно показываем, как заполнять заявления и избегать ошибок. Смотрите в удобное время и ставьте на паузу, когда заполняете бумаги параллельно с экспертом.",
  },
  {
    title: "Текстовые материалы и шаблоны",
    text: "Проверенные шаблоны, с которыми уже прошли банкротство 500+ учеников. Просто подставьте свои данные — не нужно искать по интернету устаревшие образцы.",
  },
  {
    title: "Домашние задания с проверкой",
    text: "Заполняете документы и отправляете на проверку эксперту. Исправляете ошибки до подачи в суд — а не после отказа.",
  },
  {
    title: "Кураторство",
    text: "Не останетесь один на один с проблемой со старта до полного списания. Куратор разберёт вашу ситуацию, поддержит на сложных этапах и поможет не сдаться на полпути.",
  },
];

export default function Format() {
  return (
    <section className="px-6 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#a16207]">
            Формат практикума
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-[#111111] sm:text-4xl">
            Обучение, материалы и поддержка — в одном наборе инструментов.
          </h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {formats.map((format) => (
            <article key={format.title} className="rounded-[1.5rem] border border-black/10 bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.05)]">
              <h3 className="mb-3 text-xl font-semibold text-[#111111]">{format.title}</h3>
              <p className="text-base leading-7 text-[#4b4b4b]">{format.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
