import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Самостоятельное банкротство",
  description: "Информация о самостоятельном банкротстве и законных шагах по списанию долгов.",
  alternates: {
    canonical: "/samostoyatelnoe-bankrotstvo",
  },
};

export default function SamostoyatelnoeBankrotstvoPage() {
  return (
    <section className="px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-black/10 bg-white p-8 shadow-[0_20px_70px_rgba(0,0,0,0.08)] lg:p-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-[#a16207]">
          Самостоятельное банкротство
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-[#111111] sm:text-4xl">
          Самостоятельное банкротство: основные этапы и ограничения
        </h1>
        <p className="mt-6 text-lg leading-8 text-[#4b4b4b]">
          Здесь будет размещён контент о процедуре, правах и ограничениях для должников.
        </p>
      </div>
    </section>
  );
}
