"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

import { CASE_STAGE_FLOW } from "@/lib/platform/case-progress";
import styles from "./IBuroProgressV2.module.css";

type CaseStage = { code: string; label: string; position: number | null; total: number };

export function CaseStageTimeline({ stage }: { stage: CaseStage }) {
  const stageScrollerRef = useRef<HTMLDivElement>(null);
  const currentStageRef = useRef<HTMLLIElement>(null);

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
  }, [stage.position]);

  return (
    <section className={styles.stages} aria-labelledby="case-stage-timeline-heading">
      <div className={styles.sectionHeading}>
        <div><span>Процедура</span><h2 id="case-stage-timeline-heading">Этапы дела</h2></div>
        <small>Актуально по данным дела</small>
      </div>
      <div
        ref={stageScrollerRef}
        className={styles.stageScroller}
        tabIndex={0}
        role="region"
        aria-label="Горизонтальная лента этапов дела"
      >
        <ol>
          {CASE_STAGE_FLOW.map((item, index) => {
            const position = index + 1;
            const current = stage.position === position;
            const complete = stage.position !== null && position < stage.position;
            return (
              <li
                key={item.code}
                ref={current ? currentStageRef : undefined}
                className={current ? styles.stageCurrent : complete ? styles.stageComplete : ""}
                aria-current={current ? "step" : undefined}
              >
                <div className={styles.stageLine}><span>{complete ? <Check aria-hidden="true" /> : position}</span></div>
                <p>{item.label}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
