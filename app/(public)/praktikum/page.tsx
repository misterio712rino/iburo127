import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  ArrowRight,
  PlayCircle,
  FileText,
  ShieldCheck,
  BookOpen,
} from "lucide-react";

import Benefits from "@/components/sections/Benefits";
import ContactCTA from "@/components/sections/ContactCTA";
import PracticeHighlight from "@/components/sections/PracticeHighlight";
import Pricing from "@/components/sections/Pricing";
import Timeline from "@/components/sections/Timeline";

export const metadata: Metadata = {
  title: "Практикум «Самостоятельное банкротство»",
  description:
    "Пошаговая система самостоятельного прохождения процедуры банкротства физических лиц.",
  alternates: {
    canonical: "/praktikum",
  },
};

const advantages = [
  "Пошаговые видеоинструкции",
  "Шаблоны документов",
  "Автоматически заполненные документы",
  "Практические инструкции",
];

export default function PraktikumPage() {
  return (
    <main className="bg-[#F7F5F2]">
      {/* HERO */}

      <section className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-20 lg:grid-cols-2">
            {/* Левая часть */}

            <div>
              <span className="inline-flex rounded-full border border-[#E8DED5] bg-white px-5 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-[#7B2330]">
                Практикум
              </span>

              <h1 className="mt-8 text-6xl font-bold leading-tight text-[#2B2B2B]">
                Самостоятельное
                <br />
                банкротство
                <br />
                физических лиц
              </h1>

              <p className="mt-8 max-w-2xl text-xl leading-9 text-[#666]">
                Полная система самостоятельного прохождения процедуры
                банкротства без дорогостоящих юридических услуг.
                Простые инструкции, документы и готовый алгоритм действий.
              </p>

              <div className="mt-10 grid gap-5">
                {advantages.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-4"
                  >
                    <CheckCircle2 className="h-6 w-6 text-[#7B2330]" />

                    <span className="text-lg text-[#2B2B2B]">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-12 flex flex-wrap gap-5">
                <Link
                  href="#pricing"
                  className="rounded-full bg-[#7B2330] px-9 py-4 font-semibold text-white transition hover:bg-[#651A25]"
                >
                  Выбрать тариф
                </Link>

                <Link
                  href="/bankruptcy-check"
                  className="inline-flex items-center rounded-full border border-[#7B2330] px-9 py-4 font-semibold text-[#7B2330]"
                >
                  Проверить возможность

                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>
            </div>

            {/* Правая часть */}

            <div>
              <div className="rounded-[42px] bg-[#111111] p-10 text-white shadow-2xl">
                <span className="text-sm uppercase tracking-[0.3em] text-[#C89A4A]">
                  Что входит
                </span>

                <h2 className="mt-5 text-3xl font-bold">
                  Полный комплект
                  <br />
                  материалов
                </h2>

                <div className="mt-10 space-y-5">
                  <div className="flex items-start gap-5 rounded-2xl bg-white/5 p-5">
                    <PlayCircle className="mt-1 h-7 w-7 shrink-0 text-[#C89A4A]" />

                    <div>
                      <h3 className="font-semibold">
                        Видеоуроки
                      </h3>

                      <p className="mt-2 text-white/70">
                        Каждый этап процедуры подробно показан и объяснен.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-5 rounded-2xl bg-white/5 p-5">
                    <FileText className="mt-1 h-7 w-7 shrink-0 text-[#C89A4A]" />

                    <div>
                      <h3 className="font-semibold">
                        Документы
                      </h3>

                      <p className="mt-2 text-white/70">
                        Все шаблоны заявлений уже подготовлены.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-5 rounded-2xl bg-white/5 p-5">
                    <BookOpen className="mt-1 h-7 w-7 shrink-0 text-[#C89A4A]" />

                    <div>
                      <h3 className="font-semibold">
                        Инструкции
                      </h3>

                      <p className="mt-2 text-white/70">
                        Пошаговый алгоритм действий от начала до окончания процедуры.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-5 rounded-2xl bg-white/5 p-5">
                    <ShieldCheck className="mt-1 h-7 w-7 shrink-0 text-[#C89A4A]" />

                    <div>
                      <h3 className="font-semibold">
                        Законность
                      </h3>

                      <p className="mt-2 text-white/70">
                        Все материалы основаны на действующем законодательстве РФ.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Pricing />
      <PracticeHighlight />
      <Benefits />
      <Timeline />
      <ContactCTA />
    </main>
  );
}