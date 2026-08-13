import Link from "next/link";
import { LockKeyhole, Sparkles } from "lucide-react";
import { PlatformCard, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { Button } from "@/components/ui/button";
import type { PlanCode } from "@/lib/platform/types";

export function AiLockedState({ plan }: { plan: PlanCode }) {
  return <div className="flex flex-col gap-8"><SectionHeader title="AI-помощник" description="Поможет разобраться в текущем этапе и работе платформы." /><PlatformCard className="relative overflow-hidden p-6 sm:p-10"><Sparkles className="absolute -bottom-12 -right-10 size-56 text-primary opacity-[.05]" aria-hidden="true" /><span className="grid size-12 place-items-center rounded-2xl bg-muted text-primary"><LockKeyhole className="size-5" aria-hidden="true" /></span><p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-primary">Тариф {plan === "LITE" ? "ЛАЙТ" : "ПРО"}</p><h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-.045em]">AI-помощник доступен в тарифе ИНДИВИДУАЛЬНЫЙ</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">Расширенное сопровождение с ответами в контексте материалов дела доступно в старшем тарифе. Ваши текущие инструменты продолжают работать без изменений.</p><Button render={<Link href="/app/client" />} nativeButton={false} variant="outline" className="mt-7 h-11 rounded-full px-5">Вернуться в кабинет</Button></PlatformCard></div>;
}
