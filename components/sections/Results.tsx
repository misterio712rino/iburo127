const results = [
  {
    title: "Списание долгов до 0 ₽",
    text: "По кредитам, займам, распискам, задолженностям перед ЖКХ (кроме исключений по закону).",
  },
  {
    title: "Уверенность в завтрашнем дне",
    text: "Не придётся переживать из-за чужих ошибок и неприятных сюрпризов, вы пройдёте свою процедуру сами.",
  },
  {
    title: "Монетизация знаний и пошаговая инструкция",
    text: "Поможете близким без поиска надёжного юриста или проведёте процедуру знакомым за деньги.",
  },
  {
    title: "Сохранение имущества и ипотеки",
    text: "Поймёте, как сохранить автомобиль, недвижимость, ипотеку в рамках закона (на тарифе «Эксклюзив»).",
  },
];

export default function Results() {
  return (
    <section className="px-6 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#a16207]">
            Что получаете после практикума
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-[#111111] sm:text-4xl">
            Чёткая схема действий, понятные документы и реальный шанс начать заново.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {results.map((item) => (
            <article key={item.title} className="rounded-[1.5rem] border border-black/10 bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.05)]">
              <h3 className="mb-3 text-xl font-semibold text-[#111111]">{item.title}</h3>
              <p className="text-base leading-7 text-[#4b4b4b]">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
