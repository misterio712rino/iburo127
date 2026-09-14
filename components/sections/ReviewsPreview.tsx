import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function ReviewsPreview() {
  return (
    <section id="reviews" className="bg-white py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-[#7B2330]">
            Отзывы клиентов
          </span>

          <h2 className="mt-6 text-5xl font-bold leading-tight text-[#2B2B2B]">
            Публикуем только
            <br />
            подтверждённые отзывы.
          </h2>

          <p className="mt-8 text-xl leading-9 text-[#666]">
            Мы не используем неподтверждённые истории как реальные отзывы.
            Публичные отзывы появятся после проверки источника и согласия клиента
            на публикацию.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl rounded-[32px] border border-[#ECE3D8] bg-[#FDFBF8] p-10 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7B2330]/10">
            <ShieldCheck className="h-8 w-8 text-[#7B2330]" />
          </div>

          <h3 className="mt-6 text-2xl font-semibold text-[#2B2B2B]">
            Проверяемость важнее красивых цифр
          </h3>

          <p className="mt-4 leading-8 text-[#666]">
            До появления подтверждённых отзывов вы можете оценить сервис по
            публичным материалам, предварительной проверке и консультации.
          </p>
        </div>

        <div className="mt-12 flex justify-center gap-4">
          <Link
            href="/reviews"
            className="inline-flex items-center rounded-full border border-[#7B2330]/20 px-8 py-4 text-lg font-semibold text-[#7B2330] transition hover:bg-[#7B2330]/5"
          >
            Политика публикации отзывов
            <ArrowRight className="ml-3 h-5 w-5" />
          </Link>

          <Link
            href="/contacts"
            className="inline-flex items-center rounded-full bg-[#7B2330] px-8 py-4 text-lg font-semibold text-white transition hover:bg-[#641B25]"
          >
            Связаться с нами
          </Link>
        </div>
      </div>
    </section>
  );
}
