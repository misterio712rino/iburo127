import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Защита от коллекторов",
  description: "Правовая защита от коллекторов и методы законного противодействия.",
  alternates: { canonical: "/services/zashchita-ot-kollektorov" },
};

export default function DebtProtectionPage() {
  return (
    <section className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-black/10 bg-white p-8 shadow-[0_20px_70px_rgba(0,0,0,0.08)] lg:p-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#a16207]">Защита от коллекторов</p>
        <h1 className="text-3xl font-semibold leading-tight text-[#111111] sm:text-4xl">
          Защита от коллекторов
        </h1>
      </div>
    </section>
  );
}
