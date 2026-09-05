"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  PlayCircle,
  Sparkles,
} from "lucide-react";

import {
  PRACTICUM_LESSONS,
  PRACTICUM_MODULES,
  getLessonModule,
} from "@/lib/platform/practicum-content";
import styles from "./IBuroPracticumV2.module.css";

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

export function IBuroPracticumV2({
  caseId,
  initialState,
}: {
  caseId: string;
  initialState: PracticumState | null;
}) {
  const [state, setState] = useState<PracticumState | null>(initialState);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = useMemo(
    () => new Set(state?.completedLessonIds ?? []),
    [state?.completedLessonIds],
  );

  async function createProgress() {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`/api/platform/cases/${caseId}/practicum`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as ApiResult;
      if (!result.ok) throw new Error(result.error.code);
      setState(normalize(result.data));
    } catch {
      setError("Не удалось начать практикум. Обновите страницу и повторите попытку.");
    } finally {
      setCreating(false);
    }
  }

  if (!state) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Обучение</span>
            <h1>Практикум</h1>
            <p>Короткая программа, которая помогает понимать каждый следующий этап процедуры.</p>
          </div>
          <div className={styles.headerIcon}><BookOpen aria-hidden="true" /></div>
        </header>

        <section className={styles.startCard}>
          <div className={styles.startIcon}><Sparkles aria-hidden="true" /></div>
          <span className={styles.cardLabel}>12 уроков · 4 модуля</span>
          <h2>Начните с основ и двигайтесь в своём темпе</h2>
          <p>Прогресс сохраняется в вашем деле автоматически и синхронизируется между устройствами.</p>
          <button type="button" className={styles.primaryButton} onClick={createProgress} disabled={creating}>
            {creating ? <Loader2 className={styles.spin} aria-hidden="true" /> : <PlayCircle aria-hidden="true" />}
            {creating ? "Запускаем…" : "Начать практикум"}
          </button>
        </section>

        {error ? <div className={styles.error} role="alert">{error}</div> : null}
      </div>
    );
  }

  const completedCount = completed.size;
  const total = PRACTICUM_LESSONS.length;
  const percent = Math.round((completedCount / total) * 100);
  const complete = completedCount === total;
  const currentLesson =
    PRACTICUM_LESSONS.find((lesson) => !completed.has(lesson.id)) ??
    PRACTICUM_LESSONS[PRACTICUM_LESSONS.length - 1];
  const currentModule = getLessonModule(currentLesson);
  const currentLessonHref = `/portal/cases/${caseId}/practicum/${currentLesson.id}`;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Обучение</span>
          <h1>Практикум</h1>
          <p>Всё необходимое, чтобы ориентироваться в процедуре и понимать ближайшие действия.</p>
        </div>
        <div className={styles.headerProgress}>
          <strong>{percent}%</strong>
          <span>{completedCount} из {total} уроков</span>
        </div>
      </header>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      <section className={styles.topGrid}>
        <article className={styles.continueCard}>
          <span className={styles.continueEyebrow}>{complete ? "Программа завершена" : "Продолжить обучение"}</span>
          <h2>{complete ? "Все уроки пройдены" : currentLesson.title}</h2>
          <p>
            {complete
              ? "Материалы остаются доступными — можно вернуться к любому уроку."
              : `Модуль ${currentModule.number} · ${currentLesson.duration}`}
          </p>
          <Link href={currentLessonHref} className={styles.whiteButton}>
            {complete ? "Открыть урок" : "Продолжить урок"}
            <ArrowRight aria-hidden="true" />
          </Link>
          <BookOpen className={styles.continueDecoration} aria-hidden="true" />
        </article>

        <article className={styles.progressCard}>
          <div className={styles.progressTop}>
            <div>
              <span>Ваш прогресс</span>
              <strong>{percent}%</strong>
            </div>
            {complete ? <CheckCircle2 className={styles.doneIcon} aria-hidden="true" /> : null}
          </div>
          <div className={styles.progressTrack} role="progressbar" aria-label="Прогресс практикума" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <p>{completedCount} из {total} уроков завершено</p>
        </article>
      </section>

      <section className={styles.programSection} aria-labelledby="program-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="program-title">Программа</h2>
            <p>Откройте урок, чтобы перейти в отдельное пространство обучения.</p>
          </div>
          <span>{PRACTICUM_MODULES.length} модуля</span>
        </div>

        <div className={styles.modules}>
          {PRACTICUM_MODULES.map((module) => {
            const lessonIds: readonly string[] = module.lessonIds;
            const moduleLessons = PRACTICUM_LESSONS.filter((lesson) => lessonIds.includes(lesson.id));
            const moduleDone = moduleLessons.filter((lesson) => completed.has(lesson.id)).length;

            return (
              <section className={styles.moduleCard} key={module.id}>
                <header className={styles.moduleHeader}>
                  <div className={styles.moduleNumber}>{module.number}</div>
                  <div className={styles.moduleTitle}>
                    <span>Модуль {module.number}</span>
                    <h3>{module.title}</h3>
                    <p>{module.description}</p>
                  </div>
                  <div className={styles.moduleMeta}>{moduleDone}/{moduleLessons.length}</div>
                </header>

                <div className={styles.lessons}>
                  {moduleLessons.map((lesson) => {
                    const isDone = completed.has(lesson.id);
                    const isCurrent = !complete && lesson.id === currentLesson.id;
                    const href = `/portal/cases/${caseId}/practicum/${lesson.id}`;

                    return (
                      <div
                        className={`${styles.lesson} ${isCurrent ? styles.lessonCurrent : ""}`}
                        key={lesson.id}
                      >
                        <Link href={href} className={styles.lessonSummary}>
                          <span className={`${styles.lessonStatus} ${isDone ? styles.lessonDone : ""}`}>
                            {isDone ? <Check aria-hidden="true" /> : lesson.number}
                          </span>
                          <span className={styles.lessonCopy}>
                            <strong>{lesson.title}</strong>
                            <small><Clock3 aria-hidden="true" />{lesson.duration}</small>
                          </span>
                          <span className={styles.lessonState}>
                            {isDone ? "Открыть" : isCurrent ? "Продолжить" : "Начать"}
                          </span>
                          <ChevronRight className={styles.chevron} aria-hidden="true" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
