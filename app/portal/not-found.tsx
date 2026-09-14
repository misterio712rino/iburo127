import Link from "next/link";
import { PortalSystemState } from "@/components/portal/PortalSystemState";

export default function PortalNotFound() {
  return (
    <PortalSystemState
      variant="error"
      title="Раздел не найден или недоступен"
      description="Проверьте ссылку или вернитесь на рабочий стол. iБюро не показывает, существует ли недоступный вашей учётной записи ресурс."
      action={
        <Link
          href="/portal"
          className="inline-flex min-h-11 max-w-full items-center justify-center rounded-xl bg-[#17202a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#263342] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#17202a]/15"
        >
          На рабочий стол
        </Link>
      }
    />
  );
}
