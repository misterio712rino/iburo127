export default function CTA() {
  return (
    <section className="px-6 pb-20 pt-8 lg:px-8 lg:pb-24">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 rounded-[2rem] border border-black/10 bg-[#111111] p-8 text-white lg:flex-row lg:items-center lg:justify-between lg:p-12">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Начните путь к жизни без долгов уже сегодня!
          </h2>
          <p className="mt-4 text-lg leading-8 text-white/80">
            Каждый день промедления — это новые проценты, звонки коллекторов и стресс. Практикум даст вам чёткий план действий и уверенность в завтрашнем дне.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="#price"
            className="inline-flex items-center justify-center rounded-full bg-[#ff8a00] px-7 py-3.5 text-base font-semibold text-white transition hover:bg-[#e67d00]"
          >
            Выбрать тариф и оплатить
          </a>
          <a
            href="#popup:myform"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
          >
            Задать вопрос менеджеру
          </a>
        </div>
      </div>
    </section>
  );
}
