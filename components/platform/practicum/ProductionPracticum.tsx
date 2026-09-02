"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Info,
  Loader2,
  Play,
} from "lucide-react";

import { PlatformCard, ProgressBar } from "@/components/platform/PlatformPrimitives";
import { Button } from "@/components/ui/button";
import {
  PRACTICUM_LESSONS,
  PRACTICUM_MODULES,
  getLessonModule,
} from "@/lib/platform/practicum-content";
import { cn } from "@/lib/utils";

type PracticumState = {
  completedLessonIds: string[];
  version: number;
  completedAt: string | null;
};

type ApiSuccess = {
  ok: true;
  data: PracticumState;
};

type ApiFailure = {
  ok: false;
  error: { code: string };
};

type ApiResult = ApiSuccess | ApiFailure;

function toState(data: ApiSuccess["data"]): PracticumState {
  return {
    completedLessonIds: [...data.completedLessonIds],
    version: data.version,
    completedAt: data.completedAt,
  };
}

export function ProductionPracticum({
  caseId,
  canEdit,
  initialState,
}: {
  caseId: string;
  canEdit: boolean;
  initialState: PracticumState | null;
}) {
  const [state, setState] = useState<PracticumState | null>(initialState);
  const [pendingLessonId, setPendingLessonId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completedSet = useMemo(
    () => new Set(state?.completedLessonIds ?? []),
    [state?.completedLessonIds],
  );

  async function refresh() {
    const response = await fetch(`/api/platform/cases/${caseId}/practicum`, {
      method: "GET",
      cache: "no-store",
    });
    const result = (await response.json()) as ApiResult;
    if (!result.ok) throw new Error(result.error.code);
    setState(toState(result.data));
  }

  async function createProgress() {
    if (creating || !canEdit) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`/api/platform/cases/${caseId}/practicum`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as ApiResult;
      if (!result.ok) throw new Error(result.error.code);
      setState(toState(result.data));
    } catch {
      setError("Не удалось начать практикум. Обновите страницу и повторите попытку.");
    } finally {
      setCreating(false);
    }
  }

  async function completeLesson(lessonId: string) {
    if (!state || !canEdit || pendingLessonId || completedSet.has(lessonId)) return;
    setPendingLessonId(lessonId);
    setError(null);

    try {
      const response = await fetch(
        `/api/platform/cases/${caseId}/practicum/lessons/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ lessonId, expectedVersion: state.version }),
        },
      );
      const result = (await response.json()) as ApiResult;

      if (!result.ok) {
        if (response.status === 409 || result.error.code === "VERSION_CONFLICT") {
          await refresh();
          setError("Прогресс изменился в другой вкладке. Данные обновлены — повторите действие.");
          return;
        }
        throw new Error(result.error.code);
      }

      setState(toState(result.data));
    } catch {
      setError("Не удалось сохранить прогресс. Повторите попытку.");
    } finally {
      setPendingLessonId(null);
    }
  }

  if (!state) {
    return (
      <PlatformCard className="mt-8 overflow-hidden p-6 sm:p-8">
        <div className="flex max-w-2xl flex-col items-start">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted text-primary">
            <BookOpen className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-primary">Практикум</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-.045em]">Начните программу подготовки</h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            После начала выполненные уроки будут сохраняться в вашем деле и останутся доступны после следующего входа.
          </p>
          {canEdit ? (
            <Button type="button" size="lg" className="mt-7 h-12 rounded-full px-6" onClick={createProgress} disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {creating ? "Начинаем…" : "Начать практикум"}
              {!creating ? <ArrowRight data-icon="inline-end" /> : null}
            </Button>
          ) : (
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Режим просмотра</p>
          )}
          {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
        </div>
      </PlatformCard>
    );
  }

  const completedCount = completedSet.size;
  const progressPercent = Math.round((completedCount / PRACTICUM_LESSONS.length) * 100);
  const isComplete = completedCount === PRACTICUM_LESSONS.length;
  const featured = PRACTICUM_LESSONS.find((lesson) => !completedSet.has(lesson.id)) ?? PRACTICUM_LESSONS[0];
  const featuredModule = getLessonModule(featured);

  if (!canEdit) {
    return (
      <div className="mt-8 space-y-6">
        <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Прогресс</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{progressPercent}%</p>
            </div>
            <p className="text-sm font-semibold text-slate-500">{completedCount} из {PRACTICUM_LESSONS.length} уроков</p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Прогресс практикума" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
            <div className="h-full rounded-full bg-[#7B2330] transition-[width]" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        {PRACTICUM_MODULES.map((module) => (
          <section key={module.id} className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Модуль {module.number}</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{module.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{module.description}</p>
            <div className="mt-5 space-y-3">
              {module.lessonIds.map((lessonId) => {
                const lesson = PRACTICUM_LESSONS.find((item) => item.id === lessonId);
                if (!lesson) return null;
                const completed = completedSet.has(lesson.id);
                return (
                  <article key={lesson.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex items-start gap-3">
                      {completed ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-5 shrink-0 text-slate-500" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-bold text-slate-900">{lesson.number}. {lesson.title}</h3>
                          <span className="text-xs font-semibold text-slate-400">{lesson.duration}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{lesson.introduction}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-8 sm:gap-10">
      {error ? (
        <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]">
        <PlatformCard className="practicum-continue-surface relative overflow-hidden border-primary/30 bg-primary p-6 text-primary-foreground sm:p-8">
          <BookOpen className="absolute -bottom-10 -right-8 size-52 opacity-[.08]" aria-hidden="true" />
          <p className="text-xs font-bold uppercase tracking-[.18em] opacity-75">{isComplete ? "Программа завершена" : "Продолжить обучение"}</p>
          <h2 className="mt-7 max-w-2xl text-3xl font-semibold tracking-[-.045em] sm:text-4xl">{isComplete ? "Практикум завершён" : featured.title}</h2>
          <p className="mt-4 max-w-xl text-sm leading-6 opacity-80">{isComplete ? "Все 12 уроков доступны для повторного просмотра." : `Модуль ${featuredModule.number} · ${featured.duration}`}</p>
          <Button
            type="button"
            size="lg"
            className="mt-8 h-12 rounded-full bg-primary-foreground px-6 text-primary hover:bg-primary-foreground/90"
            onClick={() => document.getElementById(`practicum-${featured.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            {isComplete ? "Повторить материал" : "Продолжить урок"}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </PlatformCard>

        <PlatformCard className="p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Обучение</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-.05em]">{progressPercent}%</p>
            </div>
            {isComplete ? <CheckCircle2 className="size-10 text-primary" aria-hidden="true" /> : <span className="text-sm font-semibold">{completedCount} / {PRACTICUM_LESSONS.length}</span>}
          </div>
          <div className="mt-7"><ProgressBar value={progressPercent} /></div>
          <p className="mt-5 text-sm text-muted-foreground">{completedCount} из {PRACTICUM_LESSONS.length} уроков завершено</p>
        </PlatformCard>
      </section>

      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Программа</h2>
          <p className="mt-2 text-sm text-muted-foreground">Ваш прогресс синхронизируется с делом и остаётся доступен после следующего входа.</p>
        </div>

        <div className="flex flex-col gap-5">
          {PRACTICUM_MODULES.map((module) => {
            const lessonIds: readonly string[] = module.lessonIds;
            const lessons = PRACTICUM_LESSONS.filter((lesson) => lessonIds.includes(lesson.id));
            const done = lessons.filter((lesson) => completedSet.has(lesson.id)).length;
            return (
              <section key={module.id} className="practicum-module-surface overflow-hidden rounded-[1.5rem] border border-border bg-card text-card-foreground shadow-[0_14px_40px_rgba(0,0,0,.045)]">
                <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Модуль {module.number}</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-.03em]">{module.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{done} из {lessons.length}</span>
                </header>
                <ol className="divide-y divide-border">
                  {lessons.map((lesson) => {
                    const completed = completedSet.has(lesson.id);
                    const current = !isComplete && featured.id === lesson.id;
                    const pending = pendingLessonId === lesson.id;
                    return (
                      <li key={lesson.id} id={`practicum-${lesson.id}`} className={cn("scroll-mt-28", current && "bg-primary/[.035]")}> 
                        <div className="flex items-start gap-4 px-5 py-4 sm:px-6">
                          <span className={cn("relative mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border text-xs font-bold", completed && "border-primary bg-primary text-primary-foreground", current && "platform-step-current border-primary text-primary ring-4 ring-primary/10", !completed && !current && "border-border bg-muted text-muted-foreground")}>
                            {completed ? <Check className="size-4" aria-hidden="true" /> : lesson.number}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-semibold">{lesson.title}</h4>
                                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3" aria-hidden="true" />{lesson.duration}</span>
                              </div>
                              <span className={cn("text-xs font-semibold", current ? "text-primary" : "text-muted-foreground")}>{completed ? "Завершено" : current ? "Текущий урок" : "Доступно"}</span>
                            </div>
                            <details className="mt-3 group">
                              <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg list-none text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
                                <Play className="size-4 text-primary" aria-hidden="true" />
                                Материал урока
                              </summary>
                              <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
                                <p>{lesson.introduction}</p>
                                {lesson.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                                <ul className="list-disc space-y-1 pl-5">{lesson.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>
                              </div>
                            </details>
                            {!completed ? (
                              <Button type="button" variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => completeLesson(lesson.id)} disabled={Boolean(pendingLessonId)} aria-busy={pending}>
                                {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                                {pending ? "Сохраняем…" : "Отметить урок пройденным"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      </section>

      <PlatformCard className="flex gap-4 p-5 sm:p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-muted text-primary"><Info className="size-5" aria-hidden="true" /></span>
        <div>
          <h2 className="font-semibold">Образовательный формат</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Практикум помогает подготовиться к следующим этапам и носит общий информационный характер. Он не заменяет индивидуальную юридическую консультацию.</p>
        </div>
      </PlatformCard>
    </div>
  );
}
