"use client";

import Link from "next/link";
import { Check, Clock, LockKeyhole, Play } from "lucide-react";
import { PRACTICUM_LESSONS, PRACTICUM_MODULES } from "@/lib/platform/demo";
import type { LessonStatus } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<LessonStatus, string> = { completed: "Завершено", current: "Текущий урок", available: "Доступно", locked: "Пока закрыто" };

export function PracticumProgram({ getStatus }: { getStatus: (id: string) => LessonStatus }) {
  return <div className="flex flex-col gap-5">{PRACTICUM_MODULES.map((module) => {
    const lessonIds: readonly string[] = module.lessonIds;
    const lessons = PRACTICUM_LESSONS.filter((lesson) => lessonIds.includes(lesson.id));
    const done = lessons.filter((lesson) => getStatus(lesson.id) === "completed").length;
    return <section key={module.id} className="overflow-hidden rounded-[1.5rem] border border-border bg-card text-card-foreground shadow-[0_14px_40px_rgba(0,0,0,.045)]">
      <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Модуль {module.number}</p><h2 className="mt-2 text-xl font-semibold tracking-[-.03em]">{module.title}</h2><p className="mt-1 text-sm text-muted-foreground">{module.description}</p></div><span className="text-xs font-semibold text-muted-foreground">{done} из {lessons.length}</span></header>
      <ol className="divide-y divide-border">{lessons.map((lesson) => {
        const status = getStatus(lesson.id); const disabled = status === "locked";
        const row = <><span className={cn("grid size-9 shrink-0 place-items-center rounded-full border text-xs font-bold", status === "completed" && "border-primary bg-primary text-primary-foreground", status === "current" && "border-primary text-primary ring-4 ring-primary/10", (status === "available" || status === "locked") && "border-border bg-muted text-muted-foreground")}>{status === "completed" ? <Check className="size-4" /> : status === "locked" ? <LockKeyhole className="size-3.5" /> : lesson.number}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{lesson.title}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3" />{lesson.duration}</span></span><span className={cn("hidden text-xs font-semibold sm:block", status === "current" ? "text-primary" : "text-muted-foreground")}>{STATUS_LABEL[status]}</span>{!disabled ? <Play className="size-4 text-muted-foreground" /> : null}</>;
        return <li key={lesson.id}>{disabled ? <div className="flex items-center gap-4 px-5 py-4 opacity-60 sm:px-6">{row}</div> : <Link href={`/app/client/practicum/${lesson.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/20 sm:px-6">{row}</Link>}</li>;
      })}</ol>
    </section>;
  })}</div>;
}
