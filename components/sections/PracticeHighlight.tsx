import Link from "next/link";
import {
  CheckCircle2,
  FileText,
  Video,
  Bot,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

const modules = [
  "Пошаговые видеоинструкции",
  "Шаблоны документов",
  "Автоматически заполненные документы",
  "Практические инструкции",
];

export default function PracticeHighlight() {
  return (
    <section className="bg-[#F7F5F2] py-28">

      <div className="mx-auto max-w-7xl px-6">

        <div className="grid items-center gap-16 lg:grid-cols-2">

          {/* Левая колонка */}

          <div>

            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7B2330]">
              Практикум
            </span>

            <h2 className="mt-6 text-5xl font-bold leading-tight text-[#2B2B2B]">
              Законный способ
              <br />
              самостоятельно
              <br />
              избавиться от долгов.
            </h2>

            <p className="mt-8 text-xl leading-9 text-[#666]">
              Практикум поможет самостоятельно пройти процедуру
              банкротства физического лица, используя понятные
              видеоинструкции, шаблоны документов,
              автоматически заполненные формы и практические
              инструкции без дорогостоящих юридических услуг.
            </p>

            <div className="mt-10 grid gap-5">

              {modules.map((item) => (

                <div
                  key={item}
                  className="group flex items-center gap-5 rounded-2xl border border-[#E8DED5] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#7B2330]/30 hover:shadow-lg"
                >

                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7B2330]/10">

                    <CheckCircle2 className="h-6 w-6 text-[#7B2330]" />

                  </div>

                  <span className="text-lg font-medium text-[#2B2B2B]">
                    {item}
                  </span>

                </div>

              ))}

            </div>

            <div className="mt-12 flex flex-wrap gap-5">

              <Link
                href="/praktikum"
                className="inline-flex items-center rounded-full bg-[#7B2330] px-8 py-4 font-semibold text-white transition hover:bg-[#641B25]"
              >
                Получить доступ
              </Link>

              <Link
                href="/bankruptcy-check"
                className="inline-flex items-center rounded-full border border-[#7B2330] px-8 py-4 font-semibold text-[#7B2330]"
              >
                Проверить возможность

                <ArrowRight className="ml-2 h-5 w-5" />

              </Link>

            </div>

          </div>

          {/* Правая колонка */}

          <div>

            <div className="rounded-[40px] bg-[#111111] p-10 text-white shadow-2xl">

              <span className="text-sm uppercase tracking-[0.3em] text-[#C89A4A]">

                Что вы получите

              </span>

              <h3 className="mt-4 text-3xl font-bold">

                Всё необходимое
                <br />
                для прохождения процедуры

              </h3>

              <div className="mt-10 space-y-5">

                <div className="flex items-center gap-5 rounded-2xl bg-white/5 p-5 transition hover:bg-white/10">

                  <Video className="h-7 w-7 shrink-0 text-[#C89A4A]" />

                  <div>
                    <h4 className="font-semibold text-white">
                      Пошаговые видеоинструкции
                    </h4>

                    <p className="mt-1 text-white/70">
                      Каждый этап процедуры подробно объясняется простым и понятным языком.
                    </p>
                  </div>

                </div>

                <div className="flex items-center gap-5 rounded-2xl bg-white/5 p-5 transition hover:bg-white/10">

                  <FileText className="h-7 w-7 shrink-0 text-[#C89A4A]" />

                  <div>
                    <h4 className="font-semibold text-white">
                      Шаблоны документов
                    </h4>

                    <p className="mt-1 text-white/70">
                      Все необходимые заявления, ходатайства и процессуальные документы уже подготовлены.
                    </p>
                  </div>

                </div>

                <div className="flex items-center gap-5 rounded-2xl bg-white/5 p-5 transition hover:bg-white/10">

                  <ShieldCheck className="h-7 w-7 shrink-0 text-[#C89A4A]" />

                  <div>
                    <h4 className="font-semibold text-white">
                      Автоматически заполненные документы
                    </h4>

                    <p className="mt-1 text-white/70">
                      Вам останется только проверить данные, распечатать документы и подать их в суд.
                    </p>
                  </div>

                </div>

                <div className="flex items-center gap-5 rounded-2xl bg-white/5 p-5 transition hover:bg-white/10">

                  <Bot className="h-7 w-7 shrink-0 text-[#C89A4A]" />

                  <div>
                    <h4 className="font-semibold text-white">
                      Практические инструкции
                    </h4>

                    <p className="mt-1 text-white/70">
                      Четкий алгоритм действий для каждого этапа процедуры без сложной юридической терминологии.
                    </p>
                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}
