export default function ContactForm() {
  return (
    <form className="rounded-[1.75rem] border border-black/10 bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.05)]">
      <div className="mb-5">
        <label className="mb-2 block text-sm font-semibold text-[#111111]" htmlFor="name">
          Имя
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          className="w-full rounded-full border border-black/10 px-4 py-3 text-sm outline-none"
          placeholder="Ваше имя"
        />
      </div>
      <div className="mb-5">
        <label className="mb-2 block text-sm font-semibold text-[#111111]" htmlFor="phone">
          Телефон
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          className="w-full rounded-full border border-black/10 px-4 py-3 text-sm outline-none"
          placeholder="Телефон"
        />
      </div>
      <div className="mb-6">
        <label className="mb-2 block text-sm font-semibold text-[#111111]" htmlFor="message">
          Вопрос
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="w-full rounded-[1.25rem] border border-black/10 px-4 py-3 text-sm outline-none"
          placeholder="Опишите ситуацию"
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-full bg-[#ff8a00] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#e67d00]"
      >
        Отправить заявку
      </button>
    </form>
  );
}
