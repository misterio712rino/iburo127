"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import Navigation from "./Navigation";
import MobileMenu from "./MobileMenu";

export default function Header() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header
      className="
        sticky
        top-0
        z-50
        border-b
        border-white/40
        bg-white/70
        backdrop-blur-2xl
        supports-[backdrop-filter]:bg-white/55
        transition-all
        duration-500
      "
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">

        {/* ---------- LOGO ---------- */}

        <Link
          href="/"
          className="
            group
            flex
            flex-col
            leading-none
            transition-all
            duration-300
            hover:opacity-80
          "
        >
          <span
            className="
              text-[30px]
              font-bold
              tracking-[-0.05em]
              text-[#1D1D1F]
              transition-colors
              duration-300
              group-hover:text-[#7B2330]
            "
          >
            iБюро
          </span>

          <span
            className="
              mt-1
              text-[10px]
              uppercase
              tracking-[0.35em]
              text-[#9A9A9A]
            "
          >
            Практикум
          </span>
        </Link>

        {/* ---------- NAVIGATION ---------- */}

        <div className="hidden flex-1 justify-center lg:flex">
          <Navigation pathname={pathname} />
        </div>

        {/* ---------- RIGHT ---------- */}

        <div className="hidden items-center gap-7 lg:flex">

          <a
            href="tel:+78432145640"
            className="
              text-[15px]
              font-medium
              tracking-[-0.01em]
              text-[#4B4B4B]
              transition-all
              duration-300
              hover:text-[#7B2330]
            "
          >
            +7 (843) 214-56-40
          </a>

          <Button
            className="
              rounded-full
              bg-[#7B2330]
              px-7
              py-6
              text-[15px]
              font-semibold
              tracking-[-0.01em]
              text-white
              shadow-lg
              transition-all
              duration-500
              hover:-translate-y-0.5
              hover:scale-[1.02]
              hover:bg-[#651B25]
              hover:shadow-2xl
            "
          >
            Бесплатная консультация
          </Button>

        </div>

        {/* ---------- MOBILE ---------- */}

        <div className="flex items-center lg:hidden">

          <MobileMenu
            pathname={pathname}
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          />

        </div>

      </div>
    </header>
  );
}