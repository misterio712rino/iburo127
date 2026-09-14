const groups = [
  {
    title: "Должник",
    description: "В долгах и не можете оплачивать дорогие услуги юриста",
    items: [
      "Остерегаетесь юристов-мошенников",
      "Хотите жизнь с чистого листа",
    ],
  },
  {
    title: "Помощник близким",
    description: "Хотите помочь родным избавиться от долговой ямы",
    items: [
      "Ищете законный способ защитить близкого человека",
      "Готовы разобраться в процедуре ради близкого",
    ],
  },
  {
    title: "Партнер",
    description: "Хотите зарабатывать на нише банкротства физлиц",
    items: [
      "Планируете открыть практику или расширить услуги",
      "Ищете пошаговую технологию ведения «нестандартных» дел",
    ],
  },
];

export default function Audience() {
  return (
    <section id="about" className="px-6 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#a16207]">
            Для кого этот практикум
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-[#111111] sm:text-4xl">
            Вы узнаете, как списать долги самостоятельно, если вы:
          </h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {groups.map((group) => (
            <article key={group.title} className="rounded-[1.5rem] border border-black/10 bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.05)]">
              <h3 className="mb-4 text-2xl font-semibold text-[#111111]">{group.title}</h3>
              <p className="mb-5 text-base leading-7 text-[#4b4b4b]">{group.description}</p>
              <ul className="space-y-3 text-sm leading-7 text-[#4b4b4b]">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff8a00]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
