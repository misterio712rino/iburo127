import { Home, Sparkles } from "lucide-react";
import type { PlanCode } from "@/lib/platform/types";

export function MortgageCapability({ plan }: { plan: PlanCode }) {
  const content = plan === "LITE"
    ? { title: "Расширенный анализ доступен в тарифе ПРО", text: "Данные об ипотеке сохранятся в анкете. Для оценки обстоятельств можно подключить расширенный анализ.", Icon: Home }
    : plan === "PRO"
      ? { title: "Расширенный анализ включён в ваш тариф", text: "Специалист сможет учесть условия ипотеки и рассмотреть возможные сценарии без гарантий результата.", Icon: Sparkles }
      : { title: "Персональный анализ включён в сопровождение", text: "Юрист изучит ипотечные обстоятельства вместе с остальными материалами дела.", Icon: Sparkles };
  const Icon = content.Icon;
  return <div className="flex min-w-0 flex-col gap-3 rounded-[1.2rem] border border-primary/25 bg-primary/8 p-4 min-[375px]:flex-row min-[375px]:gap-4 sm:p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Icon className="size-5" /></span><div className="min-w-0"><h3 className="break-words font-semibold leading-5">{content.title}</h3><p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{content.text}</p></div></div>;
}
