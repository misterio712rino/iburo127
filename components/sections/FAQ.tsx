const faqs = [
  {
    question: "Я ничего не понимаю в законах. Смогу ли я разобраться?",
    answer:
      "Да, практикум построен для людей без юридического образования. Всё объясняется простым языком с примерами и пошаговыми инструкциями.",
  },
  {
    question: "Какие долги точно не спишутся?",
    answer:
      "По закону не списываются: алименты, возмещение вреда жизни и здоровью, субсидиарная ответственность, долги по преступлениям.",
  },
  {
    question: "Сколько времени занимает процедура банкротства?",
    answer:
      "От подачи заявления до списания долгов проходит в среднем 6–12 месяцев. Первый этап (подготовка и запуск) — от 1 до 4 недель.",
  },
  {
    question: "А если у меня сложная ситуация — автомобиль, ипотека, доли в бизнесе?",
    answer:
      "Для таких случаев рекомендуем тариф «Эксклюзив» с персональным кураторством и разбором тонкостей сохранения имущества.",
  },
  {
    question: "Вы гарантируете списание долгов?",
    answer:
      "Мы даём знания и инструменты, как пройти процедуру по закону. Итоговое решение принимает суд на основе вашей ситуации.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="px-6 py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-black/10 bg-[#fbf8f2] p-8 lg:p-12">
        <div className="mb-10 max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#a16207]">
            Ответы на важные вопросы
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-[#111111] sm:text-4xl">
            Самые частые вопросы о процессе и результатах.
          </h2>
        </div>
        <div className="space-y-4">
          {faqs.map((item) => (
            <details key={item.question} className="rounded-[1.25rem] border border-black/10 bg-white p-6">
              <summary className="cursor-pointer list-none text-lg font-semibold text-[#111111]">
                {item.question}
              </summary>
              <p className="mt-3 text-base leading-7 text-[#4b4b4b]">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
