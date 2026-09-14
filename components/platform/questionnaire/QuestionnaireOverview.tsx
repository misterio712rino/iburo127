"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoIdentity } from "@/components/platform/DemoIdentityProvider";
import { PlatformCard, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { ClientRouteGuard } from "@/components/platform/practicum/ClientRouteGuard";
import { QUESTIONNAIRE_SECTIONS, isQuestionnaireFieldVisible } from "@/lib/platform/demo";
import type { PlanCode } from "@/lib/platform/types";
import { MortgageCapability } from "./MortgageCapability";
import { QuestionnaireFieldControl } from "./QuestionnaireFieldControl";
import { QuestionnaireReview } from "./QuestionnaireReview";
import { QuestionnaireSectionNav } from "./QuestionnaireSectionNav";
import { useQuestionnaireState } from "./useQuestionnaireState";

export function QuestionnaireOverview() {
  const { identity } = useDemoIdentity();
  return <ClientRouteGuard>{identity.role === "CLIENT" ? <QuestionnaireFlow key={identity.id} identityId={identity.id} plan={identity.plan!} /> : null}</ClientRouteGuard>;
}

function QuestionnaireFlow({ identityId, plan }: { identityId: string; plan: PlanCode }) {
  const state = useQuestionnaireState(identityId);
  const [currentId, setCurrentId] = useState(state.currentSection.id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const section = QUESTIONNAIRE_SECTIONS.find((item) => item.id === currentId) ?? state.currentSection;
  const visibleFields = section.fields.filter((field) => isQuestionnaireFieldVisible(field, state.answers));
  const index = QUESTIONNAIRE_SECTIONS.findIndex((item) => item.id === section.id);

  function goTo(id: string) {
    setErrors({});
    setCurrentId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continueFlow() {
    const nextErrors = state.completeSection(section.id);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const next = QUESTIONNAIRE_SECTIONS[index + 1];
    if (next) goTo(next.id);
  }

  if (!state.started) return <PlatformShell><div className="mx-auto min-w-0 max-w-4xl"><Link href="/app/client" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Вернуться в кабинет</Link><PlatformCard className="relative mt-6 min-w-0 overflow-hidden p-5 sm:mt-8 sm:p-10"><ClipboardList className="absolute -bottom-12 -right-8 size-56 text-primary opacity-[.06]" /><p className="text-sm font-semibold text-primary">Следующий этап</p><h1 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-.05em] sm:text-5xl">Анкета — следующий этап</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-5 sm:text-base sm:leading-7">После завершения вводного Практикума вы сможете последовательно заполнить сведения для подготовки документов.</p><div className="mt-6 flex min-w-0 gap-3 rounded-2xl bg-muted p-4 text-sm text-muted-foreground sm:mt-7"><Info className="size-5 shrink-0 text-primary" /><p className="min-w-0">Анкету можно заполнить заранее. Ответы сохранятся и будут доступны на следующем этапе.</p></div><Button className="mt-7 h-12 w-full rounded-full px-5 sm:mt-8 sm:w-auto sm:px-6" onClick={() => { state.start(); goTo("basics"); }}>Начать анкету<ArrowRight data-icon="inline-end" /></Button></PlatformCard></div></PlatformShell>;

  return <PlatformShell><div className="flex min-w-0 flex-col gap-5 sm:gap-8"><Link href="/app/client" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Вернуться в кабинет</Link><SectionHeader title="Анкета" description="Постепенно соберём сведения, необходимые для подготовки дела." action={<span className="inline-flex max-w-full items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4 shrink-0 text-primary" />Изменения сохранены</span>} /><div className="grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-6"><QuestionnaireSectionNav currentId={section.id} completedCount={state.completedCount} progress={state.progress} isCompleted={state.isCompleted} onSelect={goTo} /><main className="min-w-0">{section.review ? <QuestionnaireReview answers={state.answers} isComplete={state.isComplete} onEdit={goTo} onConfirm={() => state.completeSection("review")} /> : <PlatformCard className="min-w-0 overflow-hidden p-5 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Раздел {section.number} из 10</p><h1 className="mt-3 break-words text-2xl font-semibold tracking-[-.04em] sm:mt-4 sm:text-4xl">{section.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{section.description}</p><div className="mt-6 flex min-w-0 flex-col gap-6 sm:mt-8 sm:gap-7">{visibleFields.length ? visibleFields.map((field) => <QuestionnaireFieldControl key={field.id} field={field} answers={state.answers} error={errors[field.id]} onChange={(value) => { state.setAnswer(field.id, value); setErrors((current) => { const next = { ...current }; delete next[field.id]; return next; }); }} />) : <div className="min-w-0 rounded-2xl bg-muted p-4 sm:p-5"><p className="font-medium">Этот раздел не применяется</p><p className="mt-2 text-sm text-muted-foreground">По предыдущим ответам дополнительные сведения здесь не требуются.</p></div>}{section.id === "mortgage" && state.answers.hasMortgage === true ? <MortgageCapability plan={plan} /> : null}</div><div className="mt-8 flex min-w-0 flex-col-reverse gap-3 border-t border-border pt-5 sm:mt-10 sm:flex-row sm:justify-between sm:pt-6"><Button variant="outline" className="h-11 w-full rounded-full sm:w-auto" disabled={index === 0} onClick={() => goTo(QUESTIONNAIRE_SECTIONS[index - 1].id)}>Назад</Button><Button className="h-auto min-h-11 w-full whitespace-normal rounded-full px-5 py-3 text-center sm:w-auto" onClick={continueFlow}>{index === QUESTIONNAIRE_SECTIONS.length - 2 ? "Перейти к проверке" : "Сохранить и продолжить"}<ArrowRight data-icon="inline-end" /></Button></div></PlatformCard>}</main></div></div></PlatformShell>;
}
