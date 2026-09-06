import Link from "next/link";
import { Bot, CheckCircle2 } from "lucide-react";

import { PlatformCard } from "@/components/platform/PlatformPrimitives";

export function SelfServiceCard({ description }: { description: string }) {
  return (
    <PlatformCard className="flex h-full flex-col p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Формат тарифа</p>
      <div className="mt-7 flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Bot className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em]">Самостоятельно + AI</h2>
          <p className="mt-1 text-sm text-muted-foreground">Без сопровождения специалистом</p>
        </div>
      </div>
      <p className="mt-6 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-6 flex items-start gap-2 text-xs font-medium leading-5">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        AI-помощник доступен для работы с материалами вашего дела.
      </div>
      <div className="mt-auto pt-6">
        <Link
          href="/app/client/ai"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2"
        >
          Открыть AI-помощника
        </Link>
      </div>
    </PlatformCard>
  );
}