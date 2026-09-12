const benefits = [
  {
    title: "Вам не нужен юрист, чтобы пройти процедуру законно",
    text: "Вы можете действовать самостоятельно, соблюдая закон и не переплачивая за посредников.",
  },
  {
    title: "Экономия 90–250 тысяч рублей",
    text: "Юристы берут от 90 000 до 250 000+ за сопровождение. Практикум стоит от 7 990 ₽.",
  },
  {
    title: "Полный контроль процесса",
    text: "Вы понимаете каждый шаг, не зависите от чужих ошибок и сроков. Знаете свои права.",
  },
  {
    title: "Законность и прозрачность",
    text: "Всё по Федеральному закону № 127-ФЗ. Никаких серых схем — только официальная процедура.",
  },
  {
    title: "Защита от мошенников",
    text: "После обучения вы станете экспертом и больше не попадётесь на удочку псевдоюристов.",
  },
];

export default function Benefits() {
  return (
    <section className="px-6 py-28 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-black/10 bg-[#fbf8f2] p-8 lg:p-12">
        <div className="mb-10 max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#a16207]">
            Почему самостоятельное банкротство — это реально
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-[#111111] sm:text-4xl">
            Вы получите понятную систему, законный путь и защиту от ошибок.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {benefits.map((item) => (
            <article key={item.title} className="rounded-[1.25rem] border border-black/10 bg-white p-7">
              <h3 className="mb-3 text-xl font-semibold text-[#111111]">{item.title}</h3>
              <p className="text-base leading-7 text-[#4b4b4b]">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
