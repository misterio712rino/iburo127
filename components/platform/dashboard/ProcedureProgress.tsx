import { Check } from "lucide-react";

import { PlatformCard } from "@/components/platform/PlatformPrimitives";
import { PROCEDURE_STAGES } from "@/lib/platform/demo";
import { cn } from "@/lib/utils";

export function ProcedureProgress({ currentStageIndex }: { currentStageIndex: number }) {
  return (
    <PlatformCard className="p-6 sm:p-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.04em]">Этапы процедуры</h2>
        <p className="mt-2 text-sm text-muted-foreground">Ваш путь от начала работы до завершения дела.</p>
      </div>
      <ol className="mt-8 grid gap-0 md:grid-cols-9">
        {PROCEDURE_STAGES.map((stage, index) => {
          const completed = index < currentStageIndex;
          const current = index === currentStageIndex;
          return (
            <li key={stage} className="relative flex gap-4 pb-5 last:pb-0 md:block md:pb-0">
              {index < PROCEDURE_STAGES.length - 1 ? <span className="absolute bottom-0 left-[15px] top-8 w-px bg-border md:left-8 md:right-0 md:top-4 md:h-px md:w-auto" aria-hidden="true" /> : null}
              <span className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-full border text-[11px] font-bold", completed && "border-primary bg-primary text-primary-foreground", current && "platform-step-current border-primary bg-card text-primary ring-4 ring-primary/15", !completed && !current && "border-border bg-muted text-muted-foreground")} aria-current={current ? "step" : undefined}>
                {completed ? <Check className="size-4" aria-hidden="true" /> : index + 1}
              </span>
              <span className={cn("block pt-1 text-xs leading-5 md:mt-3 md:max-w-[7rem] md:pr-2", current ? "font-semibold text-foreground" : "text-muted-foreground")}>{stage}</span>
            </li>
          );
        })}
      </ol>
    </PlatformCard>
  );
}
