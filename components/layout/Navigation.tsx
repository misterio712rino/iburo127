import Link from "next/link";
import { navigationLinks } from "@/lib/navigation";

type NavigationProps = {
  pathname: string;
};

function isActiveLink(href: string, pathname: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(href);
}

export default function Navigation({ pathname }: NavigationProps) {
  return (
    <nav className="flex items-center gap-2">
      {navigationLinks.map((link) => {
        const active = isActiveLink(link.href, pathname);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`
              group
              relative
              rounded-full
              px-5
              py-2.5
              text-[15px]
              font-medium
              tracking-[-0.02em]
              transition-all
              duration-500
              ${
                active
                  ? "bg-white shadow-md text-[#1D1D1F]"
                  : "text-[#6E6E73] hover:bg-white/70 hover:text-[#1D1D1F] hover:shadow-sm"
              }
            `}
          >
            <span className="relative z-10">
              {link.label}
            </span>

            <span
              className={`
                absolute
                left-1/2
                bottom-1
                h-[2px]
                -translate-x-1/2
                rounded-full
                bg-[#7B2330]
                transition-all
                duration-500
                ${
                  active
                    ? "w-8 opacity-100"
                    : "w-0 opacity-0 group-hover:w-6 group-hover:opacity-100"
                }
              `}
            />
          </Link>
        );
      })}
    </nav>
  );
}