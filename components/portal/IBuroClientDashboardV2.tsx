import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bot,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  FileCheck2,
  FileText,
  Home,
  Sparkles,
} from "lucide-react";

import { IBuroClientShellV2, type IBuroClientCaseOptionV2 } from "./IBuroClientShellV2";
import styles from "./IBuroClientDashboardV2.module.css";

type ActivityItem = {
  id: string;
  label: string;
  dateLabel: string;
};

type DashboardProps = {
  caseId: string;
  displayName: string;
  caseDisplayNumber: string;
  planLabel: string;
  unreadCount: number;
  cases: readonly IBuroClientCaseOptionV2[];
  statusLabel: string;
  stageLabel: string;
  stagePosition: number | null;
  stageTotal: number;
  progress: number;
  openedDate: string;
  specialistName: string;
  mortgageAvailable: boolean;
  practicum: { completed: number; total: number; percent: number };
  questionnaire: { completed: number; total: number; percent: number };
  documents: { total: number; reviewed: number; sentForReview: number };
  readyFileCount: number;
  nextAction: { title: string; description: string; segment: string };
  activity: readonly ActivityItem[];
};

function firstName(displayName: string) {
  return displayName.trim().split(/\s+/u)[0] || "Клиент";
}

function specialistInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "iБ"
  );
}

function nextActionLabel(segment: string) {
  if (segment === "practicum") return "Продолжить практикум";
  if (segment === "questionnaire") return "Продолжить анкету";
  if (segment === "documents") return "Открыть документы";
  if (segment === "progress") return "Открыть прогресс";
  return "Перейти";
}

function QuickAction({
  href,
  label,
  icon: Icon,
  locked = false,
}: {
  href?: string;
  label: string;
  icon: typeof BookOpen;
  locked?: boolean;
}) {
  const content = (
    <>
      <span className={styles.quickIcon}><Icon aria-hidden="true" /></span>
      <strong>{label}</strong>
    </>
  );

  if (!href || locked) {
    return <div className={`${styles.quickAction} ${styles.quickActionLocked}`} aria-disabled="true">{content}</div>;
  }

  return <Link className={styles.quickAction} href={href}>{content}</Link>;
}

function MiniProgressCard({
  title,
  value,
  detail,
  percent,
  href,
}: {
  title: string;
  value: string;
  detail: string;
  percent: number;
  href: string;
}) {
  return (
    <article className={`${styles.card} ${styles.miniProgressCard}`}>
      <div className={styles.miniProgressHeader}>
        <h3>{title}</h3>
        <strong>{value}</strong>
      </div>
      <p>{detail}</p>
      <div className={styles.progressTrack} aria-label={`Прогресс ${Math.round(percent)}%`}>
        <span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      <Link href={href}>Открыть →</Link>
    </article>
  );
}

export function IBuroClientDashboardV2(props: DashboardProps) {
  const base = `/portal/cases/${props.caseId}`;
  const boundedProgress = Math.max(0, Math.min(100, props.progress));
  const stagePosition = props.stagePosition ?? 1;
  const completedSegments = Math.max(0, Math.min(props.stageTotal, stagePosition - 1));

  return (
    <IBuroClientShellV2
      caseId={props.caseId}
      displayName={props.displayName}
      caseDisplayNumber={props.caseDisplayNumber}
      planLabel={props.planLabel}
      unreadCount={props.unreadCount}
      cases={props.cases}
    >
      <div className={styles.dashboard}>
        <section className={styles.heroHeader} aria-labelledby="client-home-title">
          <div>
            <p className={styles.eyebrow}>Личный кабинет</p>
            <h1 id="client-home-title">Добрый день, {firstName(props.displayName)}</h1>
            <p>Здесь собраны ближайшие действия, документы и движение вашего дела.</p>
          </div>
          <span className={styles.casePill}>{props.caseDisplayNumber} · {props.planLabel}</span>
        </section>

        <section className={styles.primaryGrid} aria-label="Главное по делу">
          <article className={styles.nextCard}>
            <p className={styles.nextLabel}>Следующий шаг</p>
            <h2>{props.nextAction.title}</h2>
            <p className={styles.nextDescription}>{props.nextAction.description}</p>
            <Link className={styles.nextCta} href={`${base}/${props.nextAction.segment}`}>
              {nextActionLabel(props.nextAction.segment)} <ArrowRight aria-hidden="true" />
            </Link>
          </article>

          <article className={`${styles.card} ${styles.statusCard}`}>
            <div className={styles.cardTopline}>
              <span className={styles.cardLabel}>Состояние дела</span>
              <span className={styles.statusBadge}>{props.statusLabel}</span>
            </div>
            <h2 className={styles.statusStage}>{props.stageLabel}</h2>
            <div className={styles.progressMeta}>
              <span>Движение по маршруту</span>
              <strong>{boundedProgress}%</strong>
            </div>
            <div className={styles.progressTrack} aria-label={`Прогресс дела ${boundedProgress}%`}>
              <span style={{ width: `${boundedProgress}%` }} />
            </div>
            <div className={styles.statusFooter}>
              <div><span>Дело открыто</span><strong>{props.openedDate}</strong></div>
              <div><span>Специалист</span><strong>{props.specialistName}</strong></div>
            </div>
          </article>
        </section>

        <section className={styles.quickActions} aria-label="Быстрые действия">
          <QuickAction href={`${base}/practicum`} label="Практикум" icon={BookOpen} />
          <QuickAction href={`${base}/questionnaire`} label="Анкета" icon={ClipboardList} />
          <QuickAction href={`${base}/documents`} label="Документы" icon={FileText} />
          <QuickAction href={`${base}/progress`} label="Прогресс" icon={ChartNoAxesColumnIncreasing} />
          <QuickAction href={`${base}/ai`} label="AI-помощник" icon={Sparkles} />
          <QuickAction href={`${base}/files`} label="Файлы" icon={FileCheck2} />
        </section>

        {props.mortgageAvailable ? (
          <div className={styles.serviceHint}><Home aria-hidden="true" /><span><strong>Ипотечное жильё</strong> — для вашего тарифа доступна индивидуальная оценка обстоятельств специалистом.</span></div>
        ) : null}

        <section aria-labelledby="case-overview-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="case-overview-title">Моё дело</h2>
              <p>Текущий этап и готовность основных материалов.</p>
            </div>
            <Link href={`${base}/progress`}>Подробнее</Link>
          </div>

          <div className={styles.overviewGrid}>
            <article className={`${styles.card} ${styles.caseProgressCard}`}>
              <div className={styles.caseProgressTop}>
                <div>
                  <span className={styles.cardLabel}>Текущий этап</span>
                  <h3>{props.stageLabel}</h3>
                  <p>{props.stagePosition ? `Этап ${props.stagePosition} из ${props.stageTotal}` : "Этап уточняется"}</p>
                </div>
                <strong className={styles.progressBig}>{boundedProgress}%</strong>
              </div>
              <div
                className={styles.stageRoute}
                style={{ "--stage-count": Math.max(1, props.stageTotal) } as CSSProperties}
                aria-label="Маршрут дела"
              >
                {Array.from({ length: Math.max(1, props.stageTotal) }, (_, index) => (
                  <span
                    key={index}
                    className={`${styles.stageSegment} ${index < completedSegments || index === stagePosition - 1 ? styles.stageSegmentDone : ""}`}
                  />
                ))}
              </div>
              <div className={styles.stageCaption}>Показывает положение этапа в маршруте, а не прогноз срока завершения процедуры.</div>
            </article>

            <div className={styles.sideStack}>
              <MiniProgressCard
                title="Практикум"
                value={`${props.practicum.completed}/${props.practicum.total}`}
                detail={props.practicum.percent >= 100 ? "Обучение завершено" : "Продолжайте обучение в удобном темпе"}
                percent={props.practicum.percent}
                href={`${base}/practicum`}
              />
              <MiniProgressCard
                title="Анкета"
                value={`${props.questionnaire.completed}/${props.questionnaire.total}`}
                detail={props.questionnaire.percent >= 100 ? "Анкета заполнена" : props.questionnaire.percent > 0 ? "Заполнение можно продолжить в любой момент" : "Анкета ещё не начата"}
                percent={props.questionnaire.percent}
                href={`${base}/questionnaire`}
              />
            </div>
          </div>
        </section>

        <section className={styles.lowerGrid} aria-label="Документы и события">
          <article className={`${styles.card} ${styles.documentsCard}`}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Документы</h2>
                <p>Готовность комплекта по вашему делу.</p>
              </div>
              <Link href={`${base}/documents`}>Все документы</Link>
            </div>
            <div className={styles.metricList}>
              <div className={styles.metricRow}><span>Всего сформировано</span><strong>{props.documents.total}</strong></div>
              <div className={styles.metricRow}><span>На проверке у специалиста</span><strong>{props.documents.sentForReview}</strong></div>
              <div className={styles.metricRow}><span>Проверено</span><strong>{props.documents.reviewed}</strong></div>
              <div className={styles.metricRow}><span>Готовых файлов</span><strong>{props.readyFileCount}</strong></div>
            </div>
          </article>

          <article className={`${styles.card} ${styles.activityCard}`}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Последние события</h2>
                <p>Подтверждённые изменения по вашему делу.</p>
              </div>
              <Link href={`${base}/activity`}>Вся история</Link>
            </div>
            {props.activity.length ? (
              <div className={styles.activityList}>
                {props.activity.map((item) => (
                  <div className={styles.activityItem} key={item.id}>
                    <span className={styles.activityDot}><Bot aria-hidden="true" /></span>
                    <strong>{item.label}</strong>
                    <time>{item.dateLabel}</time>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>Здесь появятся подтверждённые события, когда по делу будут зафиксированы новые действия.</div>
            )}
          </article>
        </section>

        <section className={`${styles.card} ${styles.specialistCard}`} aria-label="Ваш специалист">
          <span className={styles.specialistAvatar}>{specialistInitials(props.specialistName)}</span>
          <div className={styles.specialistCopy}>
            <span>Ваш специалист</span>
            <strong>{props.specialistName}</strong>
            <p>Сопровождение и проверка материалов дела.</p>
          </div>
          <Link href={`${base}/activity`}>История сопровождения</Link>
        </section>
      </div>
    </IBuroClientShellV2>
  );
}
