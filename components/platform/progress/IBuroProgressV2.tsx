"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  FileText,
  Flag,
  FolderOpen,
} from "lucide-react";

import { CASE_STAGE_FLOW } from "@/lib/platform/case-progress";
import styles from "./IBuroProgressV2.module.css";

type ProgressSummary = {
  stage: { code: string; label: string; position: number | null; total: number };
  practicum: { completed: number; total: number; percent: number; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" };
  questionnaire: { completed: number; total: number; percent: number; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" };
  documents: { total: number; readyForReview: number; sentForReview: number; reviewed: number };
  readyFileCount: number;
  nextAction: { title: string; description: string; segment: string };
};

const STATUS_LABELS = {
  NOT_STARTED: "Не начато",
  IN_PROGRESS: "В процессе",
  COMPLETED: "Завершено",
} as const;

export function IBuroProgressV2({ caseId, summary }: { caseId: string; summary: ProgressSummary }) {
  const stageScrollerRef = useRef<HTMLDivElement>(null);
  const currentStageRef = useRef<HTMLLIElement>(null);
  const currentIndex = summary.stage.position ? summary.stage.position - 1 : -1;
  const nextStage = currentIndex >= 0 ? CASE_STAGE_FLOW[currentIndex + 1]?.label ?? "Завершено" : "Уточняется";
  const routePercent = summary.stage.position && summary.stage.total > 1
    ? Math.round(((summary.stage.position - 1) / (summary.stage.total - 1)) * 100)
    : 0;
  const documentsReady = summary.documents.readyForReview + summary.documents.sentForReview + summary.documents.reviewed;
  const documentPercent = summary.documents.total > 0 ? Math.round((documentsReady / summary.documents.total) * 100) : 0;
  const base = `/portal/cases/${caseId}`;

  useEffect(() => {
    const scroller = stageScrollerRef.current;
    const currentStage = currentStageRef.current;
    if (!scroller || !currentStage || !window.matchMedia("(max-width: 960px)").matches) return;

    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const centeredLeft = currentStage.offsetLeft - (scroller.clientWidth - currentStage.offsetWidth) / 2;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    scroller.scrollTo({
      left: Math.max(0, Math.min(maxLeft, centeredLeft)),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [summary.stage.position]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Ваше дело</span>
          <h1>Мой прогресс</h1>
          <p>Показываем текущее положение дела и готовность материалов — без прогнозов сроков и результата процедуры.</p>
        </div>
        <div className={styles.headerProgress}><strong>{routePercent}%</strong><span>маршрут дела</span></div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroIcon}><Flag aria-hidden="true" /></div>
        <div className={styles.heroCopy}>
          <span>Текущий этап</span>
          <h2>{summary.stage.label}</h2>
          <p>Следующий этап: {nextStage}</p>
        </div>
        <div className={styles.heroProgress}>
          <div><span>{summary.stage.position ? `Этап ${summary.stage.position} из ${summary.stage.total}` : "Этап уточняется"}</span><strong>{routePercent}%</strong></div>
          <div className={styles.track} role="progressbar" aria-label="Положение дела в маршруте" aria-valuemin={0} aria-valuemax={100} aria-valuenow={routePercent}><span style={{ width: `${routePercent}%` }} /></div>
          <small>Индикатор отражает только положение в маршруте этапов.</small>
        </div>
      </section>

      <section className={styles.stages} aria-labelledby="v2-progress-stages">
        <div className={styles.sectionHeading}><div><span>Процедура</span><h2 id="v2-progress-stages">Этапы дела</h2></div><small>Актуально по данным дела</small></div>
        <div
          ref={stageScrollerRef}
          className={styles.stageScroller}
          tabIndex={0}
          role="region"
          aria-label="Горизонтальная лента этапов дела"
        >
          <ol>
            {CASE_STAGE_FLOW.map((stage, index) => {
              const position = index + 1;
              const current = summary.stage.position === position;
              const complete = summary.stage.position !== null && position < summary.stage.position;
              return (
                <li
                  key={stage.code}
                  ref={current ? currentStageRef : undefined}
                  className={current ? styles.stageCurrent : complete ? styles.stageComplete : ""}
                  aria-current={current ? "step" : undefined}
                >
                  <div className={styles.stageLine}><span>{complete ? <Check aria-hidden="true" /> : position}</span></div>
                  <p>{stage.label}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Готовность материалов дела">
        <Metric icon={BookOpen} title="Практикум" value={`${summary.practicum.completed} из ${summary.practicum.total}`} detail={STATUS_LABELS[summary.practicum.status]} percent={summary.practicum.percent} href={`${base}/practicum`} />
        <Metric icon={ClipboardCheck} title="Анкета" value={`${summary.questionnaire.completed} из ${summary.questionnaire.total}`} detail={STATUS_LABELS[summary.questionnaire.status]} percent={summary.questionnaire.percent} href={`${base}/questionnaire`} />
        <Metric icon={FileText} title="Документы" value={`${documentsReady} готово`} detail={summary.documents.sentForReview ? `${summary.documents.sentForReview} на проверке` : summary.documents.reviewed ? `${summary.documents.reviewed} проверено` : "Готовность комплекта"} percent={documentPercent} href={`${base}/documents`} />
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.nextCard}>
          <span className={styles.cardEyebrow}>Ближайшее действие</span>
          <h2>{summary.nextAction.title}</h2>
          <p>{summary.nextAction.description}</p>
          <Link href={`${base}/${summary.nextAction.segment}`}>Перейти <ArrowRight aria-hidden="true" /></Link>
        </article>
        <article className={styles.materialsCard}>
          <div className={styles.materialsIcon}><FolderOpen aria-hidden="true" /></div>
          <div><span className={styles.cardEyebrow}>Материалы дела</span><h2>{summary.readyFileCount} безопасных файлов</h2><p>Проверено специалистом документов: {summary.documents.reviewed}<br />На проверке: {summary.documents.sentForReview}</p><Link href={`${base}/files`}>Открыть файлы <ArrowRight aria-hidden="true" /></Link></div>
        </article>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, title, value, detail, percent, href }: { icon: typeof BookOpen; title: string; value: string; detail: string; percent: number; href: string }) {
  return (
    <article className={styles.metric}>
      <div className={styles.metricTop}><span><Icon aria-hidden="true" /></span><strong>{value}</strong></div>
      <h3>{title}</h3><p>{detail}</p>
      <div className={styles.track} role="progressbar" aria-label={`Прогресс: ${title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
      <Link href={href}>Открыть <ArrowRight aria-hidden="true" /></Link>
    </article>
  );
}
