"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardList,
  Home,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";

import {
  QUESTIONNAIRE_SECTIONS,
  isQuestionnaireFieldVisible,
} from "@/lib/platform/questionnaire-content";
import type {
  PlanCode,
  QuestionnaireAnswer,
  QuestionnaireAnswers,
  QuestionnaireField,
} from "@/lib/platform/types";
import styles from "./IBuroQuestionnaireV2.module.css";

type QuestionnaireState = {
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  answers: QuestionnaireAnswers;
  completedSectionIds: string[];
  version: number;
  completedAt: string | null;
};

type ApiFailure = { ok: false; error: { code: string } };
type ApiSuccess = { ok: true; data: QuestionnaireState };
type ApiResult = ApiSuccess | ApiFailure;
type DraftValue = string | boolean;

function toDrafts(answers: QuestionnaireAnswers): Record<string, DraftValue> {
  const drafts: Record<string, DraftValue> = {};
  for (const [fieldId, answer] of Object.entries(answers)) {
    drafts[fieldId] = typeof answer === "number" ? String(answer) : answer;
  }
  return drafts;
}

function parseDraft(field: QuestionnaireField, value: DraftValue | undefined): QuestionnaireAnswer | undefined {
  if (field.type === "yes-no") return typeof value === "boolean" ? value : undefined;
  if (field.type === "number" || field.type === "currency") {
    if (typeof value !== "string" || value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  if (typeof value !== "string") return undefined;
  return value;
}

function MortgageNotice({ plan }: { plan: PlanCode }) {
  const content = plan === "LITE"
    ? { title: "Расширенный анализ доступен в тарифе ПРО", text: "Данные об ипотеке сохранятся в анкете. Расширенный анализ можно подключить отдельно.", Icon: Home }
    : plan === "PRO"
      ? { title: "Расширенный анализ включён", text: "Специалист сможет учесть условия ипотеки и рассмотреть возможные сценарии без гарантий результата.", Icon: Sparkles }
      : { title: "Персональный анализ включён", text: "Юрист изучит ипотечные обстоятельства вместе с остальными материалами дела.", Icon: Sparkles };
  const Icon = content.Icon;
  return (
    <div className={styles.mortgageNotice}>
      <span><Icon aria-hidden="true" /></span>
      <div><strong>{content.title}</strong><p>{content.text}</p></div>
    </div>
  );
}

export function IBuroQuestionnaireV2({
  caseId,
  planCode,
  initialState,
}: {
  caseId: string;
  planCode: PlanCode;
  initialState: QuestionnaireState | null;
}) {
  const [state, setState] = useState<QuestionnaireState | null>(initialState);
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>(() => toDrafts(initialState?.answers ?? {}));
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState(
    initialState?.completedSectionIds.length
      ? QUESTIONNAIRE_SECTIONS.find((section) => !initialState.completedSectionIds.includes(section.id))?.id ?? QUESTIONNAIRE_SECTIONS.at(-1)?.id ?? QUESTIONNAIRE_SECTIONS[0].id
      : QUESTIONNAIRE_SECTIONS[0].id,
  );

  const visibleAnswers = useMemo(() => state?.answers ?? {}, [state?.answers]);

  function applyState(next: QuestionnaireState) {
    setState(next);
    setDrafts(toDrafts(next.answers));
  }

  function goTo(id: string) {
    setError(null);
    setCurrentId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refresh() {
    const response = await fetch(`/api/platform/cases/${caseId}/questionnaire`, { method: "GET", cache: "no-store" });
    const result = (await response.json()) as ApiResult;
    if (!result.ok) throw new Error(result.error.code);
    applyState(result.data);
  }

  async function start() {
    if (pendingKey) return;
    setPendingKey("start");
    setError(null);
    try {
      const response = await fetch(`/api/platform/cases/${caseId}/questionnaire`, { method: "POST", headers: { Accept: "application/json" } });
      const result = (await response.json()) as ApiResult;
      if (!result.ok) throw new Error(result.error.code);
      applyState(result.data);
      setCurrentId(QUESTIONNAIRE_SECTIONS[0].id);
    } catch {
      setError("Не удалось начать анкету. Обновите страницу и повторите попытку.");
    } finally {
      setPendingKey(null);
    }
  }

  async function handleConflict(result: ApiFailure) {
    await refresh();
    setError(result.error.code === "VERSION_CONFLICT"
      ? "Анкета изменилась в другой вкладке. Мы обновили данные — повторите действие."
      : "Действие невозможно для текущего состояния анкеты. Проверьте обязательные поля.");
  }

  async function saveField(field: QuestionnaireField) {
    if (!state || state.status === "COMPLETED" || pendingKey) return;
    const value = parseDraft(field, drafts[field.id]);
    if (value === undefined) {
      setError("Проверьте значение поля перед сохранением.");
      return;
    }
    setPendingKey(`field:${field.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/platform/cases/${caseId}/questionnaire/answers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ fieldId: field.id, value, expectedVersion: state.version }),
      });
      const result = (await response.json()) as ApiResult;
      if (!result.ok) {
        if (response.status === 409) { await handleConflict(result); return; }
        if (result.error.code === "INVALID_INPUT") { setError("Не удалось сохранить значение. Проверьте формат данных."); return; }
        throw new Error(result.error.code);
      }
      applyState(result.data);
    } catch {
      setError("Не удалось сохранить ответ. Повторите попытку.");
    } finally {
      setPendingKey(null);
    }
  }

  async function completeSection(sectionId: string) {
    if (!state || state.status === "COMPLETED" || pendingKey) return;
    setPendingKey(`section:${sectionId}`);
    setError(null);
    try {
      const response = await fetch(`/api/platform/cases/${caseId}/questionnaire/sections/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sectionId, expectedVersion: state.version }),
      });
      const result = (await response.json()) as ApiResult;
      if (!result.ok) {
        if (response.status === 409) { await handleConflict(result); return; }
        throw new Error(result.error.code);
      }
      applyState(result.data);
      const index = QUESTIONNAIRE_SECTIONS.findIndex((section) => section.id === sectionId);
      const next = QUESTIONNAIRE_SECTIONS[index + 1];
      if (next) goTo(next.id);
    } catch {
      setError("Не удалось завершить раздел. Проверьте обязательные поля и сохраните изменённые ответы.");
    } finally {
      setPendingKey(null);
    }
  }

  async function completeQuestionnaire() {
    if (!state || state.status === "COMPLETED" || pendingKey) return;
    setPendingKey("complete");
    setError(null);
    try {
      const response = await fetch(`/api/platform/cases/${caseId}/questionnaire/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ expectedVersion: state.version }),
      });
      const result = (await response.json()) as ApiResult;
      if (!result.ok) {
        if (response.status === 409) { await handleConflict(result); return; }
        throw new Error(result.error.code);
      }
      applyState(result.data);
    } catch {
      setError("Не удалось завершить анкету. Убедитесь, что все разделы проверены.");
    } finally {
      setPendingKey(null);
    }
  }

  if (!state) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div><span className={styles.eyebrow}>Сведения по делу</span><h1>Анкета</h1><p>Отвечайте по порядку. Система сохраняет сведения в вашем деле и подсказывает, что требуется дальше.</p></div>
          <span className={styles.headerIcon}><ClipboardList aria-hidden="true" /></span>
        </header>
        <section className={styles.startCard}>
          <span className={styles.startIcon}><ClipboardList aria-hidden="true" /></span>
          <p className={styles.cardLabel}>10 разделов</p>
          <h2>Соберём данные без длинной бумажной анкеты</h2>
          <p>Каждый раздел короткий. Вы можете остановиться и продолжить позже — сохранённые ответы останутся в деле.</p>
          <button type="button" className={styles.primaryButton} onClick={start} disabled={Boolean(pendingKey)} aria-busy={pendingKey === "start"}>
            {pendingKey === "start" ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
            {pendingKey === "start" ? "Создаём…" : "Начать анкету"}
            {pendingKey !== "start" ? <ArrowRight aria-hidden="true" /> : null}
          </button>
        </section>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
      </div>
    );
  }

  const completedSet = new Set(state.completedSectionIds);
  const completedCount = completedSet.size;
  const progress = Math.round((completedCount / QUESTIONNAIRE_SECTIONS.length) * 100);
  const section = QUESTIONNAIRE_SECTIONS.find((item) => item.id === currentId) ?? QUESTIONNAIRE_SECTIONS[0];
  const visibleFields = section.fields.filter((field) => isQuestionnaireFieldVisible(field, visibleAnswers));
  const index = QUESTIONNAIRE_SECTIONS.findIndex((item) => item.id === section.id);
  const isReview = Boolean(section.review);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>Сведения по делу</span><h1>Анкета</h1><p>Заполняйте разделы последовательно. Ответы можно корректировать до окончательного завершения.</p></div>
        <div className={styles.headerProgress}><strong>{progress}%</strong><span>{completedCount} из {QUESTIONNAIRE_SECTIONS.length} разделов</span></div>
      </header>

      <section className={styles.progressCard}>
        <div><strong>{state.status === "COMPLETED" ? "Анкета завершена" : `Раздел ${section.number}: ${section.title}`}</strong><span>{pendingKey ? "Сохраняем изменения…" : "Все сохранённые данные синхронизированы с делом"}</span></div>
        <div className={styles.progressTrack} role="progressbar" aria-label="Прогресс анкеты" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
      </section>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      <div className={styles.workspace}>
        <aside className={styles.sectionRail} aria-label="Разделы анкеты">
          <div className={styles.railTitle}>Разделы</div>
          {QUESTIONNAIRE_SECTIONS.map((item) => {
            const done = completedSet.has(item.id);
            const active = item.id === section.id;
            return (
              <button key={item.id} type="button" className={`${styles.railItem} ${active ? styles.railItemActive : ""}`} onClick={() => goTo(item.id)} aria-current={active ? "step" : undefined}>
                <span className={`${styles.railNumber} ${done ? styles.railDone : ""}`}>{done ? <Check aria-hidden="true" /> : item.number}</span>
                <span><strong>{item.title}</strong><small>{done ? "Подтверждено" : active ? "Текущий раздел" : "Не завершено"}</small></span>
              </button>
            );
          })}
        </aside>

        <main className={styles.formCard}>
          <div className={styles.formHeading}>
            <span>Раздел {section.number} из {QUESTIONNAIRE_SECTIONS.length}</span>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </div>

          {isReview ? (
            <div className={styles.reviewArea}>
              <div className={styles.reviewNotice}><CheckCircle2 aria-hidden="true" /><div><strong>Проверьте заполненные разделы</strong><p>Анкета завершится только после серверной проверки обязательных полей и подтверждения всех разделов.</p></div></div>
              <div className={styles.reviewGrid}>
                {QUESTIONNAIRE_SECTIONS.filter((item) => !item.review).map((item) => (
                  <button key={item.id} type="button" onClick={() => goTo(item.id)}>
                    <span>{item.number}</span><div><strong>{item.title}</strong><small>{completedSet.has(item.id) ? "Раздел подтверждён" : "Требует подтверждения"}</small></div><ArrowRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : visibleFields.length ? (
            <div className={styles.fields}>
              {visibleFields.map((field) => (
                <FieldEditorV2
                  key={field.id}
                  field={field}
                  value={drafts[field.id]}
                  disabled={state.status === "COMPLETED" || Boolean(pendingKey)}
                  pending={pendingKey === `field:${field.id}`}
                  onChange={(value) => setDrafts((previous) => ({ ...previous, [field.id]: value }))}
                  onSave={() => saveField(field)}
                />
              ))}
              {section.id === "mortgage" && state.answers.hasMortgage === true ? <MortgageNotice plan={planCode} /> : null}
            </div>
          ) : (
            <div className={styles.notApplicable}><strong>Этот раздел не применяется</strong><p>По предыдущим ответам дополнительные сведения здесь не требуются.</p></div>
          )}

          {state.status !== "COMPLETED" ? (
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryButton} disabled={index === 0 || Boolean(pendingKey)} onClick={() => goTo(QUESTIONNAIRE_SECTIONS[index - 1].id)}><ArrowLeft aria-hidden="true" />Назад</button>
              {isReview ? (
                <button type="button" className={styles.primaryButton} onClick={completeQuestionnaire} disabled={Boolean(pendingKey)} aria-busy={pendingKey === "complete"}>
                  {pendingKey === "complete" ? <Loader2 className={styles.spin} aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                  {pendingKey === "complete" ? "Завершаем…" : "Завершить анкету"}
                </button>
              ) : (
                <button type="button" className={styles.primaryButton} onClick={() => completeSection(section.id)} disabled={Boolean(pendingKey)} aria-busy={pendingKey === `section:${section.id}`}>
                  {pendingKey === `section:${section.id}` ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
                  {pendingKey === `section:${section.id}` ? "Проверяем…" : completedSet.has(section.id) ? "Проверить и продолжить" : "Сохранить и продолжить"}
                  {pendingKey !== `section:${section.id}` ? <ArrowRight aria-hidden="true" /> : null}
                </button>
              )}
            </div>
          ) : (
            <div className={styles.completedBanner}><CheckCircle2 aria-hidden="true" />Анкета завершена и больше не принимает изменения.</div>
          )}
        </main>
      </div>
    </div>
  );
}

function FieldEditorV2({ field, value, disabled, pending, onChange, onSave }: {
  field: QuestionnaireField;
  value: DraftValue | undefined;
  disabled: boolean;
  pending: boolean;
  onChange: (value: DraftValue) => void;
  onSave: () => void;
}) {
  const controlId = `questionnaire-v2-${field.id}`;
  const hintId = field.hint ? `${controlId}-hint` : undefined;
  const label = <>{field.label}{field.required ? <span className={styles.required} aria-hidden="true">*</span> : null}</>;

  if (field.type === "yes-no") {
    return (
      <fieldset className={styles.field} aria-describedby={hintId}>
        <legend>{label}</legend>
        <div className={styles.segmented}>
          {[true, false].map((option) => <button key={String(option)} type="button" disabled={disabled} aria-pressed={value === option} onClick={() => onChange(option)} className={value === option ? styles.segmentActive : ""}>{option ? "Да" : "Нет"}</button>)}
        </div>
        {field.hint ? <small id={hintId}>{field.hint}</small> : null}
        {!disabled ? <SaveFieldButton pending={pending} onSave={onSave} /> : null}
      </fieldset>
    );
  }

  return (
    <div className={styles.field}>
      <label htmlFor={controlId}>{label}</label>
      {field.type === "select" || field.type === "radio" ? (
        <select id={controlId} aria-describedby={hintId} value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">Выберите вариант</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      ) : field.type === "textarea" ? (
        <textarea id={controlId} aria-describedby={hintId} value={typeof value === "string" ? value : ""} disabled={disabled} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input id={controlId} aria-describedby={hintId} type={field.type === "date" ? "date" : field.type === "number" || field.type === "currency" ? "number" : "text"} min={field.type === "number" || field.type === "currency" ? 0 : undefined} value={typeof value === "boolean" ? "" : value ?? ""} disabled={disabled} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
      {field.hint ? <small id={hintId}>{field.hint}</small> : null}
      {!disabled ? <SaveFieldButton pending={pending} onSave={onSave} /> : null}
    </div>
  );
}

function SaveFieldButton({ pending, onSave }: { pending: boolean; onSave: () => void }) {
  return <button type="button" onClick={onSave} className={styles.saveField} aria-busy={pending}>{pending ? <Loader2 className={styles.spin} aria-hidden="true" /> : <Save aria-hidden="true" />}{pending ? "Сохраняем…" : "Сохранить поле"}</button>;
}
