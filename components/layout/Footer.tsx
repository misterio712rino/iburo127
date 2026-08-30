import Link from "next/link";
import {
  Globe,
  Mail,
  MessageCircleMore,
  Phone,
} from "lucide-react";

const footerLinks = [
  { href: "/", label: "Главная" },
  { href: "/about", label: "О компании" },
  { href: "/praktikum", label: "Практикум" },
  { href: "/reviews", label: "Отзывы" },
  { href: "/faq", label: "FAQ" },
  { href: "/contacts", label: "Контакты" },
];

const socialLinks = [
  {
    href: "https://t.me/",
    label: "Telegram",
    icon: MessageCircleMore,
  },
  {
    href: "mailto:127pro@mail.ru",
    label: "Email",
    icon: Mail,
  },
  {
    href: "tel:+78432145640",
    label: "Телефон",
    icon: Phone,
  },
  {
    href: "https://www.iburo127.ru",
    label: "Сайт",
    icon: Globe,
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-[#E5E5E7] bg-[#F5F5F7]">

      <div className="mx-auto max-w-7xl px-8 py-24">

        <div className="grid gap-20 lg:grid-cols-[1.4fr_1fr_1fr]">

          {/* Левая колонка */}

          <div>

            <Link
              href="/"
              className="inline-block text-[34px] font-semibold tracking-[-0.04em] text-[#1D1D1F] transition-all duration-300 hover:opacity-70"
            >
              iБюро
            </Link>

            <p className="mt-8 max-w-md text-[18px] leading-9 text-[#6E6E73]">
              Практикум по самостоятельному банкротству физических лиц.
              Законная помощь, понятные инструкции и современные цифровые решения.
            </p>

            <div className="mt-10 flex gap-4">

              {socialLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="
                      flex h-12 w-12 items-center justify-center
                      rounded-full
                      border border-[#E5E5E7]
                      bg-white
                      transition-all
                      duration-300
                      hover:-translate-y-1
                      hover:border-[#7B2330]
                      hover:shadow-lg
                    "
                  >
                    <Icon className="h-5 w-5 text-[#444]" />
                  </a>
                );
              })}

            </div>

          </div>

          {/* Навигация */}

<div>

  <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#7B2330]">
    Навигация
  </h3>

  <nav className="mt-8 flex flex-col gap-5">

    {footerLinks.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        className="
          text-[17px]
          text-[#4B4B4F]
          transition-all
          duration-300
          hover:translate-x-1
          hover:text-[#7B2330]
        "
      >
        {item.label}
      </Link>
    ))}

  </nav>

</div>

{/* Контакты */}

<div>

  <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#7B2330]">
    Контакты
  </h3>

  <div className="mt-8 space-y-8">

    <div>

      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#9A9AA0]">
        Телефоны
      </p>

      <a
        href="tel:+78432145640"
        className="
          block
          text-[18px]
          font-medium
          text-[#1D1D1F]
          transition-colors
          duration-300
          hover:text-[#7B2330]
        "
      >
        +7 (843) 214-56-40
      </a>

      <a
        href="tel:+79520397884"
        className="
          mt-3
          block
          text-[18px]
          font-medium
          text-[#1D1D1F]
          transition-colors
          duration-300
          hover:text-[#7B2330]
        "
      >
        +7 (952) 039-78-84
      </a>

    </div>

    <div>

      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#9A9AA0]">
        Электронная почта
      </p>

      <a
        href="mailto:127pro@mail.ru"
        className="block text-[#4B4B4F] transition hover:text-[#7B2330]"
      >
        127pro@mail.ru
      </a>

      <a
        href="mailto:SRO.GAU@mail.ru"
        className="mt-3 block text-[#4B4B4F] transition hover:text-[#7B2330]"
      >
        SRO.GAU@mail.ru
      </a>

      <a
        href="mailto:Bconsalt@internet.ru"
        className="mt-3 block text-[#4B4B4F] transition hover:text-[#7B2330]"
      >
        Bconsalt@internet.ru
      </a>

    </div>

  </div>

</div>

        </div>

        <div className="mt-20 border-t border-[#E5E5E7] pt-8">

  <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

    <div className="flex flex-wrap gap-8">

      <Link
        href="/contacts"
        className="
          text-sm
          text-[#6E6E73]
          transition-colors
          duration-300
          hover:text-[#7B2330]
        "
      >
        Контакты
      </Link>

      <Link
        href="/privacy"
        className="
          text-sm
          text-[#6E6E73]
          transition-colors
          duration-300
          hover:text-[#7B2330]
        "
      >
        Политика конфиденциальности
      </Link>

      <Link
        href="/offer"
        className="
          text-sm
          text-[#6E6E73]
          transition-colors
          duration-300
          hover:text-[#7B2330]
        "
      >
        Пользовательское соглашение
      </Link>

    </div>

    <p className="text-sm text-[#8A8A8E]">
      © 2026 iБюро. Все права защищены.
    </p>

  </div>

</div>

      </div>

    </footer>
  );
}