"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCheck, FileText, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/platform/dashboard/ActivityFeed";
import { ProcedureProgress } from "@/components/platform/dashboard/ProcedureProgress";
import { useDemoIdentity } from "@/components/platform/DemoIdentityProvider";
import { PlatformCard, ProgressBar, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { ClientRouteGuard } from "@/components/platform/practicum/ClientRouteGuard";
import { usePracticumProgress } from "@/components/platform/practicum/usePracticumProgress";
import { useQuestionnaireState } from "@/components/platform/questionnaire/useQuestionnaireState";
import { useDocumentState } from "@/components/platform/documents/useDocumentState";
import { generateDocuments, getCaseForIdentity, getDashboardForIdentity, getQuestionnaireSummary, PROCEDURE_STAGES } from "@/lib/platform/demo";

export function ClientProgress() {
  return <ClientRouteGuard><PlatformShell><ProgressContent /></PlatformShell></ClientRouteGuard>;
}

function ProgressContent() {
  const { identity } = useDemoIdentity();
  const clientCase = getCaseForIdentity(identity.id)!;
  const dashboard = getDashboardForIdentity(identity.id)!;
  const practicum = usePracticumProgress(identity.id);
  const questionnaire = useQuestionnaireState(identity.id);
  const documentsState = useDocumentState(identity.id);
  const documents = generateDocuments(identity.id, getQuestionnaireSummary(questionnaire.answers), documentsState.state);
  const readyDocuments = documents.filter((item) => item.status === "ready_for_review" || item.status === "sent_for_review" || item.status === "reviewed").length;
  const nextStage = PROCEDURE_STAGES[dashboard.currentStageIndex + 1] ?? "Завершено";
  return <div className="flex min-w-0 flex-col gap-7 sm:gap-9">
    <SectionHeader title="Мой прогресс" description="Полная картина движения вашего дела по этапам." action={<Button render={<Link href="/app/client" />} nativeButton={false} variant="outline" className="h-11 rounded-full px-5">На главную</Button>} />
    <PlatformCard className="relative overflow-hidden border-primary/25 p-6 sm:p-8"><Flag className="absolute -bottom-10 -right-8 size-48 text-primary opacity-[.06]"/><div className="relative grid gap-7 lg:grid-cols-[1.2fr_.8fr] lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Текущий этап</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{clientCase.stage}</h2><p className="mt-3 text-sm text-muted-foreground">Следующий этап: {nextStage}</p></div><div><div className="mb-3 flex items-end justify-between"><span className="text-sm text-muted-foreground">Общий прогресс</span><strong className="text-4xl tracking-[-.05em]">{clientCase.progress}%</strong></div><ProgressBar value={clientCase.progress}/></div></div></PlatformCard>
    <ProcedureProgress currentStageIndex={dashboard.currentStageIndex}/>
    <section className="grid gap-4 md:grid-cols-3"><ProgressMetric icon={BookOpen} title="Практикум" value={`${practicum.completedCount} из 12`} progress={practicum.progress} detail={practicum.isComplete ? "Обучение завершено" : `Текущий урок: ${practicum.currentLesson?.title ?? "Программа"}`} href="/app/client/practicum"/><ProgressMetric icon={ClipboardCheck} title="Анкета" value={`${questionnaire.completedCount} из 10`} progress={questionnaire.progress} detail={questionnaire.isComplete ? "Анкета заполнена" : `Текущий раздел: ${questionnaire.currentSection.title}`} href="/app/client/questionnaire"/><ProgressMetric icon={FileText} title="Документы" value={`${readyDocuments} готово`} progress={Math.round(documents.reduce((sum,item)=>sum+item.completeness,0)/documents.length)} detail={readyDocuments ? "Материалы готовы к проверке" : "Ожидают данных анкеты"} href="/app/client/documents"/></section>
    <section className="grid items-start gap-5 lg:grid-cols-[1.1fr_.9fr]"><PlatformCard className="p-5 sm:p-6"><h2 className="text-2xl font-semibold">Ближайшие действия</h2><div className="mt-5 flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><ArrowRight className="size-5"/></span><div><p className="font-semibold">{dashboard.nextStep.title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{dashboard.nextStep.description}</p></div></div></PlatformCard><PlatformCard className="p-5 sm:p-6"><h2 className="text-2xl font-semibold">Последние этапы</h2><div className="mt-5"><ActivityFeed activity={dashboard.activity.slice(0,3)}/></div></PlatformCard></section>
  </div>;
}

function ProgressMetric({icon:Icon,title,value,progress,detail,href}:{icon:typeof BookOpen;title:string;value:string;progress:number;detail:string;href:string}) { return <PlatformCard className="flex min-w-0 flex-col p-5 sm:p-6"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-muted text-primary"><Icon className="size-5"/></span><span className="font-semibold">{value}</span></div><h2 className="mt-5 text-lg font-semibold">{title}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{detail}</p><div className="mt-5"><ProgressBar value={progress}/></div><Link href={href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">Открыть<ArrowRight className="size-4"/></Link></PlatformCard>; }
