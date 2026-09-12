"use client";

import { CheckCircle2, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformCard } from "@/components/platform/PlatformPrimitives";
import { QUESTIONNAIRE_SECTIONS, isQuestionnaireFieldVisible } from "@/lib/platform/demo";
import type { QuestionnaireAnswers } from "@/lib/platform/types";

function formatValue(value: QuestionnaireAnswers[string]) {
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (typeof value === "number") return new Intl.NumberFormat("ru-RU").format(value);
  return String(value);
}

export function QuestionnaireReview({ answers, isComplete, onEdit, onConfirm }: { answers: QuestionnaireAnswers; isComplete: boolean; onEdit: (id: string) => void; onConfirm: () => void }) {
  return <div className="flex min-w-0 flex-col gap-5 sm:gap-6"><div className="min-w-0"><p className="text-sm font-semibold text-primary">Итоговая проверка</p><h1 className="mt-3 break-words text-2xl font-semibold tracking-[-.04em] sm:text-4xl">Проверьте данные</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">На основе этих сведений платформа сможет подготовить документы. При необходимости вернитесь к любому разделу.</p></div>
    <div className="grid min-w-0 gap-4">{QUESTIONNAIRE_SECTIONS.filter((section) => !section.review).map((section) => { const values = section.fields.filter((field) => isQuestionnaireFieldVisible(field, answers) && answers[field.id] !== undefined && answers[field.id] !== ""); return <PlatformCard key={section.id} className="min-w-0 overflow-hidden p-4 sm:p-6"><div className="flex min-w-0 flex-col items-start gap-2 min-[375px]:flex-row min-[375px]:items-center min-[375px]:justify-between"><h2 className="min-w-0 break-words text-base font-semibold sm:text-lg">{section.title}</h2><Button variant="ghost" size="sm" className="shrink-0" onClick={() => onEdit(section.id)}><Pencil data-icon="inline-start" />Изменить</Button></div>{values.length ? <dl className="mt-4 grid min-w-0 gap-4 sm:mt-5 sm:grid-cols-2">{values.map((field) => <div key={field.id} className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{field.label}</dt><dd className="mt-1 break-words text-sm font-medium">{formatValue(answers[field.id])}</dd></div>)}</dl> : <p className="mt-4 text-sm text-muted-foreground">Сведения не указаны или раздел не применим.</p>}</PlatformCard>; })}</div>
    <PlatformCard className="min-w-0 overflow-hidden border-primary/25 bg-primary/8 p-4 sm:p-6"><div className="flex min-w-0 flex-col gap-3 min-[375px]:flex-row min-[375px]:gap-4"><FileText className="size-6 shrink-0 text-primary min-[375px]:mt-1" /><div className="min-w-0"><h2 className="break-words text-lg font-semibold">Следующий этап — документы</h2><p className="mt-2 break-words text-sm leading-6 text-muted-foreground">Ответы формируют структурированный набор сведений для подготовки документов. Юридические выводы автоматически не формируются.</p></div></div><Button className="mt-5 h-auto min-h-11 w-full whitespace-normal rounded-full px-5 py-3 text-center sm:mt-6 sm:w-auto" onClick={onConfirm} disabled={isComplete}>{isComplete ? <CheckCircle2 data-icon="inline-start" /> : null}{isComplete ? "Анкета заполнена" : "Перейти к подготовке документов"}</Button>{isComplete ? <p className="mt-3 text-xs leading-5 text-muted-foreground" role="status">Данные готовы для подготовки документов.</p> : null}</PlatformCard>
  </div>;
}
