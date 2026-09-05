"use client";

import Link from "next/link";
import { PortalSystemState } from "@/components/portal/PortalSystemState";

export default function PortalError({ reset }: { reset: () => void }) {
  return (
    <PortalSystemState
      variant="error"
      title="Не удалось открыть раздел"
      description="Повторите загрузку. Если ошибка сохранится, вернитесь на рабочий стол кабинета и продолжите работу оттуда."
      action={
        <>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 max-w-full items-center justify-center rounded-xl bg-[#17202a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#263342] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#17202a]/15"
          >
            Повторить загрузку
          </button>
          <Link
            href="/portal"
            className="inline-flex min-h-11 max-w-full items-center justify-center rounded-xl border border-[#d9dde0] bg-white px-4 py-2.5 text-sm font-bold text-[#3f474e] transition hover:bg-[#f7f8f9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#17202a]/10"
          >
            На рабочий стол
          </Link>
        </>
      }
    />
  );
}
