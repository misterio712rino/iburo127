"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoIdentity } from "@/components/platform/DemoIdentityProvider";
import { PlatformCard, ProgressBar, SectionHeader } from "@/components/platform/PlatformPrimitives";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { PRACTICUM_LESSONS, getLessonModule } from "@/lib/platform/demo";
import { ClientRouteGuard } from "./ClientRouteGuard";
import { PracticumProgram } from "./PracticumProgram";
import { usePracticumProgress } from "./usePracticumProgress";

export function PracticumOverview() {
  const { identity } = useDemoIdentity();
  const state = usePracticumProgress(identity.id);
  const featured = state.currentLesson ?? PRACTICUM_LESSONS[0];
  // eslint-disable-next-line @next/next/no-assign-module-variable -- domain learning module
  const module = getLessonModule(featured);
  return <ClientRouteGuard><PlatformShell><div className="flex flex-col gap-8 sm:gap-10"><Link href="/app/client" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"><ArrowLeft className="size-4"/>Вернуться в Dashboard</Link><SectionHeader title="Практикум" description="Пошаговая программа подготовки к процедуре банкротства."/><section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]"><PlatformCard className="practicum-continue-surface relative overflow-hidden border-primary/30 bg-primary p-6 text-primary-foreground sm:p-8"><BookOpen className="absolute -bottom-10 -right-8 size-52 opacity-[.08]"/><p className="text-xs font-bold uppercase tracking-[.18em] opacity-75">{state.isComplete?"Программа завершена":"Продолжить обучение"}</p><h2 className="mt-7 max-w-2xl text-3xl font-semibold tracking-[-.045em] sm:text-4xl">{state.isComplete?"Практикум завершён":featured.title}</h2><p className="mt-4 max-w-xl text-sm leading-6 opacity-80">{state.isComplete?"Все 12 уроков доступны для повторного просмотра.":`Модуль ${module.number} · ${featured.duration}`}</p><Button render={<Link href={`/app/client/practicum/${featured.id}`}/>} nativeButton={false} size="lg" className="mt-8 h-12 rounded-full bg-primary-foreground px-6 text-primary hover:bg-primary-foreground/90">{state.isComplete?"Повторить материал":"Продолжить урок"}<ArrowRight data-icon="inline-end"/></Button></PlatformCard><PlatformCard className="p-6 sm:p-8"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Обучение</p><p className="mt-2 text-4xl font-semibold tracking-[-.05em]">{state.progress}%</p></div>{state.isComplete?<CheckCircle2 className="size-10 text-primary"/>:<span className="text-sm font-semibold">{state.completedCount} / {PRACTICUM_LESSONS.length}</span>}</div><div className="mt-7"><ProgressBar value={state.progress}/></div><p className="mt-5 text-sm text-muted-foreground">{state.completedCount} из {PRACTICUM_LESSONS.length} уроков завершено</p></PlatformCard></section><section><div className="mb-6"><h2 className="text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Программа</h2><p className="mt-2 text-sm text-muted-foreground">Материалы открываются последовательно и остаются доступны для повторения.</p></div><PracticumProgram getStatus={state.getStatus}/></section><PlatformCard className="flex gap-4 p-5 sm:p-6"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-muted text-primary"><Info className="size-5"/></span><div><h2 className="font-semibold">Образовательный формат</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Практикум помогает подготовиться к следующим этапам и носит общий информационный характер. Он не заменяет индивидуальную юридическую консультацию.</p></div></PlatformCard></div></PlatformShell></ClientRouteGuard>;
}
