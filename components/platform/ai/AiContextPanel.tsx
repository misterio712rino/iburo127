import { BriefcaseBusiness, ClipboardCheck, FileText, Scale, UserRound } from "lucide-react";
import { PlatformCard, ProgressBar } from "@/components/platform/PlatformPrimitives";
import type { AiContext } from "@/lib/platform/types";

export function AiContextPanel({ context }: { context: AiContext }) {
  const rows = [[BriefcaseBusiness, "Дело", context.caseNumber], [Scale, "Этап", context.currentStage], [ClipboardCheck, "Анкета", `${context.questionnaireProgress}%`], [FileText, "Документы", `${context.documents.readyCount} готовы`], [UserRound, "Специалист", context.assignedLawyer]] as const;
  return <div className="grid gap-4">
    <PlatformCard className="p-5 sm:p-6"><h2 className="text-lg font-semibold tracking-[-.03em]">Контекст вашего дела</h2><div className="mt-5 grid gap-4">{rows.map(([Icon, label, value]) => <div key={label} className="flex min-w-0 items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-primary"><Icon className="size-4" aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div></div>)}</div><div className="mt-6"><div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Общий прогресс</span><span className="font-semibold">{context.overallProgress}%</span></div><ProgressBar value={context.overallProgress} /></div></PlatformCard>
    <PlatformCard className="p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Связь со специалистом</p><h2 className="mt-3 text-lg font-semibold">Нужна оценка специалиста?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Подготовьте вопрос для {context.assignedLawyer}, чтобы обсудить обстоятельства дела со специалистом.</p></PlatformCard>
  </div>;
}
