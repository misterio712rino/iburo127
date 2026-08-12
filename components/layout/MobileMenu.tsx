import Link from "next/link";
import { navigationLinks } from "@/lib/navigation";

type MobileMenuProps = {
  pathname: string;
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
};

function isActiveLink(href: string, pathname: string) {
  if (href === "/") {
    return pathname === href;
  }

  if (href === "/services") {
    return pathname.startsWith("/services");
  }

  return pathname === href;
}

export default function MobileMenu({
  pathname,
  isOpen,
  onOpenChange,
}: MobileMenuProps) {
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-panel"
        aria-label={isOpen ? "Закрыть меню" : "Открыть меню"}
        className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-[#111111]"
        onClick={() => onOpenChange(!isOpen)}
      >
        {isOpen ? "Закрыть" : "Меню"}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[55] bg-black/30"
          aria-hidden="true"
          onClick={() => onOpenChange(false)}
        />
      ) : null}

      <div
        id="mobile-navigation-panel"
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
        inert={!isOpen}
        aria-label="Мобильное меню"
        className={`fixed right-0 top-0 z-[60] flex h-screen w-[85vw] max-w-sm flex-col border-l border-black/10 bg-[#f8f7f3] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.12)] transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <p className="text-lg font-semibold uppercase tracking-[0.2em] text-[#111111]">
            Меню
          </p>

          <button
            type="button"
            aria-label="Закрыть меню"
            className="rounded-full border border-black/10 px-3 py-1.5 text-sm font-semibold text-[#111111]"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </div>

        <nav
          aria-label="Мобильная навигация"
          className="flex flex-col gap-3"
        >
          {navigationLinks.map((link) => {
            const active = isActiveLink(link.href, pathname);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[#ff8a00] text-white"
                    : "text-[#1f1f1f]/80 hover:bg-white"
                }`}
                onClick={() => onOpenChange(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 border-t border-black/10 pt-6 text-sm text-[#4b4b4b]">
          <a
            href="tel:+78432145640"
            className="block font-semibold text-[#111111]"
          >
            +7 (843) 214-56-40
          </a>

          <a
            href="tel:+79520397884"
            className="block font-semibold text-[#111111]"
          >
            +7 (952) 039-78-84
          </a>

          <a
            href="/contacts"
            className="inline-flex rounded-full bg-[#ff8a00] px-5 py-3 font-semibold text-white transition hover:bg-[#e57b00]"
            onClick={() => onOpenChange(false)}
          >
            Получить консультацию
          </a>
        </div>
      </div>
    </div>
  );
}