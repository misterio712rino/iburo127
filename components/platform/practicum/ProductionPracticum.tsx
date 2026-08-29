"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import {
  PRACTICUM_LESSONS,
  PRACTICUM_MODULES,
} from "@/lib/platform/practicum-content";

type PracticumState = {
  completedLessonIds: string[];
  version: number;
  completedAt: string | null;
};

type ApiSuccess = {
  ok: true;
  data: {
    completedLessonIds: string[];
    version: number;
    completedAt: string | null;
  };
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
      <div className="mt-8 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 p-6">
        <p className="font-semibold text-slate-900">Практикум ещё не начат</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          После начала выполненные уроки будут сохраняться в этом деле и останутся доступны после следующего входа.
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={createProgress}
            disabled={creating}
            aria-busy={creating}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#17202a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {creating ? "Начинаем…" : "Начать практикум"}
          </button>
        ) : (
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Режим просмотра
          </p>
        )}
        {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      </div>
    );
  }

  const completedCount = completedSet.size;
  const progressPercent = Math.round((completedCount / PRACTICUM_LESSONS.length) * 100);

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Прогресс</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{progressPercent}%</p>
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {completedCount} из {PRACTICUM_LESSONS.length} уроков
          </p>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label="Прогресс практикума"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div className="h-full rounded-full bg-[#7B2330] transition-[width]" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {PRACTICUM_MODULES.map((module) => (
        <section key={module.id} className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Модуль {module.number}</p>
          <h2 className="mt-2 break-words text-2xl font-bold text-slate-900">{module.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{module.description}</p>

          <div className="mt-5 space-y-3">
            {module.lessonIds.map((lessonId) => {
              const lesson = PRACTICUM_LESSONS.find((item) => item.id === lessonId);
              if (!lesson) return null;
              const completed = completedSet.has(lesson.id);
              const pending = pendingLessonId === lesson.id;

              return (
                <article key={lesson.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 shrink-0 text-slate-500">
                      {completed ? <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" /> : <Circle className="size-5" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="break-words font-bold text-slate-900">{lesson.number}. {lesson.title}</h3>
                        <span className="shrink-0 text-xs font-semibold text-slate-400">{lesson.duration}</span>
                      </div>
                      <p className="mt-2 break-words text-sm leading-6 text-slate-500">{lesson.introduction}</p>
                      <details className="mt-3">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-slate-700">Материал урока</summary>
                        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                          {lesson.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                          <ul className="list-disc space-y-1 pl-5">
                            {lesson.keyPoints.map((point) => <li key={point}>{point}</li>)}
                          </ul>
                        </div>
                      </details>

                      {canEdit && !completed ? (
                        <button
                          type="button"
                          onClick={() => completeLesson(lesson.id)}
                          disabled={Boolean(pendingLessonId)}
                          aria-busy={pending}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                          {pending ? "Сохраняем…" : "Отметить урок пройденным"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {state.completedAt ? (
        <div role="status" className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
          Базовый практикум завершён.
        </div>
      ) : null}
    </div>
  );
}
