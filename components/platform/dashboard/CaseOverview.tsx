import { CalendarDays, Scale, UserRound } from "lucide-react";

import { PlatformCard, ProgressBar } from "@/components/platform/PlatformPrimitives";
import type { DemoClientCase } from "@/lib/platform/types";

export function CaseOverview({ clientCase }: { clientCase: DemoClientCase }) {
  return (
    <PlatformCard className="h-full p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Состояние дела</p>
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
          <span className="size-2 rounded-full bg-primary" />
          {clientCase.status}
        </span>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">Текущий этап</p>
      <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.04em] sm:text-3xl">{clientCase.stage}</h2>
      <div className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <span className="text-sm text-muted-foreground">Общий прогресс</span>
          <strong className="text-3xl tracking-[-0.05em]">{clientCase.progress}%</strong>
        </div>
        <ProgressBar value={clientCase.progress} />
      </div>
      <dl className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" /><div><dt className="text-xs text-muted-foreground">Дело открыто</dt><dd className="mt-1 text-sm font-semibold">{clientCase.openedDate}</dd></div></div>
        <div className="flex items-start gap-3"><UserRound className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" /><div><dt className="text-xs text-muted-foreground">Назначенный юрист</dt><dd className="mt-1 text-sm font-semibold">{clientCase.assignedLawyer}</dd></div></div>
      </dl>
      <Scale className="mt-7 size-5 text-primary opacity-70" aria-hidden="true" />
    </PlatformCard>
  );
}
