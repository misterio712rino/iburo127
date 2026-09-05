"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
} from "lucide-react";

import {
  PRACTICUM_LESSONS,
  getLessonModule,
  getPracticumLesson,
} from "@/lib/platform/practicum-content";

type PracticumState = {
  completedLessonIds: string[];
  version: number;
  completedAt: string | null;
};

type ApiSuccess = { ok: true; data: PracticumState };
type ApiFailure = { ok: false; error: { code: string } };
type ApiResult = ApiSuccess | ApiFailure;

function normalize(data: PracticumState): PracticumState {
  return {
    completedLessonIds: [...data.completedLessonIds],
    version: data.version,
    completedAt: data.completedAt,
  };
}

export function IBuroPracticumLessonV2({
  caseId,
  lessonId,
  initialState,
}: {
  caseId: string;
  lessonId: string;
  initialState: PracticumState;
}) {
  const lesson = getPracticumLesson(lessonId);
  if (!lesson) throw new Error("PRACTICUM_LESSON_NOT_FOUND");

  const module = getLessonModule(lesson);
  const lessonIndex = PRACTICUM_LESSONS.findIndex((item) => item.id === lesson.id);
  const previousLesson = lessonIndex > 0 ? PRACTICUM_LESSONS[lessonIndex - 1] : null;
  const nextLesson = lessonIndex < PRACTICUM_LESSONS.length - 1 ? PRACTICUM_LESSONS[lessonIndex + 1] : null;

  const [state, setState] = useState<PracticumState>(() => normalize(initialState));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = useMemo(
    () => new Set(state.completedLessonIds),
    [state.completedLessonIds],
  );
  const isCompleted = completed.has(lesson.id);
  const completedCount = completed.size;
  const total = PRACTICUM_LESSONS.length;
  const percent = Math.round((completedCount / total) * 100);
  const overviewHref = `/portal/cases/${caseId}/practicum`;

  async function refreshProgress() {
    const response = await fetch(`/api/platform/cases/${caseId}/practicum`, {
      method: "GET",
      cache: "no-store",
    });
    const result = (await response.json()) as ApiResult;
    if (!result.ok) throw new Error(result.error.code);
    setState(normalize(result.data));
  }

  async function completeLesson() {
    if (pending || isCompleted) return;
    setPending(true);
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
          body: JSON.stringify({ lessonId: lesson.id, expectedVersion: state.version }),
        },
      );
      const result = (await response.json()) as ApiResult;

      if (!result.ok) {
        if (response.status === 409 || result.error.code === "VERSION_CONFLICT") {
          await refreshProgress();
          setError("Прогресс изменился в другой вкладке. Данные обновлены — проверьте статус урока и повторите действие.");
          return;
        }
        throw new Error(result.error.code);
      }

      setState(normalize(result.data));
    } catch {
      setError("Не удалось завершить урок. Повторите попытку.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl py-3 sm:py-6">
      <Link
        href={overviewHref}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        К программе
      </Link>

      <header className="mt-5 border-b border-slate-200 pb-7 sm:mt-7 sm:pb-9">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#b51f2a]">
          <span>Модуль {module.number}</span>
          <span className="text-slate-400">Урок {lesson.number} из {total}</span>
        </div>
        <h1 className="mt-4 max-w-4xl font-[var(--font-iburo-display)] text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-5xl">
          {lesson.title}
        </h1>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span className="inline-flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" />{lesson.duration}</span>
          <span className="inline-flex items-center gap-2">
            {isCompleted ? <CheckCircle2 className="size-4 text-[#b51f2a]" aria-hidden="true" /> : <BookOpen className="size-4 text-[#b51f2a]" aria-hidden="true" />}
            {isCompleted ? "Урок завершён" : "Материал урока"}
          </span>
        </div>
      </header>

      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
        <article className="min-w-0">
          <p className="max-w-3xl text-lg font-medium leading-8 text-slate-800 sm:text-xl">{lesson.introduction}</p>

          <section className="mt-9 max-w-3xl">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-2xl">Основное</h2>
            <div className="mt-4 space-y-5 text-[15px] leading-7 text-slate-600 sm:text-base sm:leading-8">
              {lesson.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>

          <section className="mt-9 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#b51f2a]">Главное из урока</p>
            <ul className="mt-4 space-y-3">
              {lesson.keyPoints.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-6 text-slate-700">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#b51f2a] text-white">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <aside className="mt-6 flex max-w-3xl gap-3 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            <Info className="mt-0.5 size-5 shrink-0 text-[#b51f2a]" aria-hidden="true" />
            <div>
              <strong className="font-semibold text-slate-900">Важно</strong>
              <p className="mt-1">Материал носит образовательный характер. Индивидуальные правовые выводы по вашему делу делает назначенный юрист после анализа документов и обстоятельств.</p>
            </div>
          </aside>

          <section className="mt-9 max-w-3xl">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-slate-950">Что дальше</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{lesson.nextText}</p>
          </section>

          {error ? <div className="mt-6 max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div> : null}

          <div className="mt-9 max-w-3xl border-t border-slate-200 pt-6">
            {!isCompleted ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#b51f2a] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#9f1923] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b51f2a]/15 disabled:cursor-wait disabled:opacity-60"
                onClick={completeLesson}
                disabled={pending}
                aria-busy={pending}
              >
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                {pending ? "Сохраняем…" : "Завершить урок"}
              </button>
            ) : (
              <div className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700" role="status">
                <CheckCircle2 className="size-4 text-[#b51f2a]" aria-hidden="true" />
                Урок завершён
              </div>
            )}
          </div>
        </article>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24">
          <span className="text-xs font-semibold text-slate-500">Прогресс Практикума</span>
          <div className="mt-2 flex items-end justify-between gap-4">
            <strong className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">{percent}%</strong>
            <span className="pb-1 text-xs text-slate-500">{completedCount} из {total}</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Прогресс практикума" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <span className="block h-full rounded-full bg-[#b51f2a] transition-[width]" style={{ width: `${percent}%` }} />
          </div>

          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">Навигация</p>
            <div className="mt-3 grid gap-2">
              {previousLesson ? (
                <Link href={`/portal/cases/${caseId}/practicum/${previousLesson.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10">
                  <ArrowLeft className="size-4" aria-hidden="true" /> Предыдущий урок
                </Link>
              ) : null}
              {nextLesson && isCompleted ? (
                <Link href={`/portal/cases/${caseId}/practicum/${nextLesson.id}`} className="inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10">
                  Следующий урок <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              ) : nextLesson ? (
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">Завершите этот урок, чтобы перейти к следующему.</div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
