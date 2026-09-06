import { BriefcaseBusiness, ClipboardCheck, FileText, Paperclip, Scale } from "lucide-react";
import { PlatformCard } from "@/components/platform/PlatformPrimitives";
import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";
import type { AiCaseState } from "./production-api";

const STAGE_LABELS: Record<string, string> = {
  ONBOARDING: "Онбординг",
  EDUCATION: "Обучение",
  QUESTIONNAIRE: "Анкетирование",
  DOCUMENT_PREPARATION: "Подготовка документов",
  LAWYER_REVIEW: "Проверка юристом",
  FILING: "Подача документов",
  COURT: "Суд",
  PROCEDURE: "Процедура банкротства",
  COMPLETED: "Завершено",
};

export function AiContextPanel({ context }: { context: AiCaseState }) {
  const readyDocuments = context.documents.filter(
    (document) => document.status === "READY_FOR_REVIEW",
  ).length;
  const rows = [
    [BriefcaseBusiness, "Дело", getClientCaseDisplayNumber(context.caseNumber)],
    [Scale, "Этап", STAGE_LABELS[context.stageCode] ?? "Этап уточняется"],
    [ClipboardCheck, "Анкета", `${context.questionnaireCompletedSections} разделов завершено`],
    [FileText, "Документы", `${readyDocuments} готовы к проверке`],
    [Paperclip, "Загруженные файлы", String(context.readyFileCount)],
  ] as const;

  return (
    <div className="grid gap-4">
      <PlatformCard className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-[-.03em]">Контекст вашего дела</h2>
        <div className="mt-5 grid gap-4">
          {rows.map(([Icon, label, value]) => (
            <div key={label} className="flex min-w-0 items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 break-words text-sm font-semibold">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </PlatformCard>
      <PlatformCard className="p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Границы помощника</p>
        <h2 className="mt-3 text-lg font-semibold">Юридически значимые решения — со специалистом</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          AI объясняет этапы и помогает подготовить вопросы, но не подписывает и не отправляет документы от вашего имени и не заменяет окончательную оценку юриста.
        </p>
      </PlatformCard>
    </div>
  );
}
