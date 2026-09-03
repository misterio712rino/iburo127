import Link from "next/link";
import { CircleAlert, Sparkles } from "lucide-react";
import { PlatformCard, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { Button } from "@/components/ui/button";

function planLabel(planCode: string) {
  if (planCode === "LITE") return "ЛАЙТ";
  if (planCode === "PRO") return "ПРО";
  if (planCode === "INDIVIDUAL") return "ИНДИВИДУАЛЬНЫЙ";
  return "не определён";
}

export function AiLockedState({ planCode }: { planCode: string }) {
  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        title="AI-помощник"
        description="Поможет разобраться в текущем этапе и работе платформы."
      />
      <PlatformCard className="relative overflow-hidden p-6 sm:p-10">
        <Sparkles className="absolute -bottom-12 -right-10 size-56 text-primary opacity-[.05]" aria-hidden="true" />
        <span className="grid size-12 place-items-center rounded-2xl bg-muted text-primary">
          <CircleAlert className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-primary">
          Тариф {planLabel(planCode)}
        </p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-.045em]">
          Доступ к AI-помощнику не подтверждён для этого дела
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
          AI-помощник предусмотрен на всех тарифах iБюро. Если этот экран появился, причина техническая или связана с настройкой конкретного дела — это не тарифное ограничение.
        </p>
        <Button
          render={<Link href="/portal" />}
          nativeButton={false}
          variant="outline"
          className="mt-7 h-11 rounded-full px-5"
        >
          Вернуться в кабинет
        </Button>
      </PlatformCard>
    </div>
  );
}
