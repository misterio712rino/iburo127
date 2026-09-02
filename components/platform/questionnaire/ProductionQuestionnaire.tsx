"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, Info, Loader2, Save } from "lucide-react";

import { PlatformCard } from "@/components/platform/PlatformPrimitives";
import { Button } from "@/components/ui/button";
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
import { MortgageCapability } from "./MortgageCapability";
import { QuestionnaireSectionNav } from "./QuestionnaireSectionNav";

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

export function ProductionQuestionnaire({
  caseId,
  canEdit,
  planCode,
  initialState,
}: {
  caseId: string;
  canEdit: boolean;
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
    const response = await fetch(`/api/platform/cases/${caseId}/questionnaire`, {
      method: "GET",
      cache: "no-store",
    });
    const result = (await response.json()) as ApiResult;
    if (!result.ok) throw new Error(result.error.code);
    applyState(result.data);
  }

  async function start() {
    if (!canEdit || pendingKey) return;
    setPendingKey("start");
    setError(null);
    try {
      const response = await fetch(`/api/platform/cases/${caseId}/questionnaire`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
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
    setError(
      result.error.code === "VERSION_CONFLICT"
        ? "Анкета изменилась в другой вкладке. Данные обновлены — повторите действие."
        : "Действие невозможно для текущего состояния анкеты. Проверьте обязательные поля и завершённые разделы.",
    );
  }

  async function saveField(field: QuestionnaireField) {
    if (!state || !canEdit || state.status === "COMPLETED" || pendingKey) return;
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
        if (response.status === 409) {
          await handleConflict(result);
          return;
        }
        if (result.error.code === "INVALID_INPUT") {
          setError("Не удалось сохранить значение. Проверьте формат данных.");
          return;
        }
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
    if (!state || !canEdit || state.status === "COMPLETED" || pendingKey) return;
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
        if (response.status === 409) {
          await handleConflict(result);
          return;
        }
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
    if (!state || !canEdit || state.status === "COMPLETED" || pendingKey) return;
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
        if (response.status === 409) {
          await handleConflict(result);
          return;
        }
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
      <PlatformCard className="relative mt-6 min-w-0 overflow-hidden p-5 sm:mt-8 sm:p-10">
        <ClipboardList className="absolute -bottom-12 -right-8 size-56 text-primary opacity-[.06]" aria-hidden="true" />
        <p className="text-sm font-semibold text-primary">Следующий этап</p>
        <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-.05em] sm:text-5xl">Анкета — следующий этап</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-5 sm:text-base sm:leading-7">
          Последовательно заполните сведения, которые будут использоваться при подготовке материалов по вашему делу.
        </p>
        <div className="mt-6 flex min-w-0 gap-3 rounded-2xl bg-muted p-4 text-sm text-muted-foreground sm:mt-7">
          <Info className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0">Ответы сохраняются в вашем деле. К заполнению можно вернуться до окончательного завершения анкеты.</p>
        </div>
        {canEdit ? (
          <Button className="mt-7 h-12 w-full rounded-full px-5 sm:mt-8 sm:w-auto sm:px-6" onClick={start} disabled={Boolean(pendingKey)} aria-busy={pendingKey === "start"}>
            {pendingKey === "start" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pendingKey === "start" ? <span role="status">Создаём…</span> : "Начать анкету"}
            {pendingKey !== "start" ? <ArrowRight data-icon="inline-end" /> : null}
          </Button>
        ) : (
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Режим просмотра</p>
        )}
        {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
      </PlatformCard>
    );
  }

  const completedSet = new Set(state.completedSectionIds);
  const completedCount = completedSet.size;
  const progress = Math.round((completedCount / QUESTIONNAIRE_SECTIONS.length) * 100);
  const section = QUESTIONNAIRE_SECTIONS.find((item) => item.id === currentId) ?? QUESTIONNAIRE_SECTIONS[0];
  const visibleFields = section.fields.filter((field) => isQuestionnaireFieldVisible(field, visibleAnswers));
  const index = QUESTIONNAIRE_SECTIONS.findIndex((item) => item.id === section.id);
  const isReview = Boolean(section.review);

  if (!canEdit) {
    return (
      <div className="mt-8 space-y-6">
        <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Состояние анкеты</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{state.status === "COMPLETED" ? "Анкета завершена" : `${completedCount} из ${QUESTIONNAIRE_SECTIONS.length} разделов`}</p>
        </div>
        {QUESTIONNAIRE_SECTIONS.map((item) => {
          const completed = completedSet.has(item.id);
          const fields = item.fields.filter((field) => isQuestionnaireFieldVisible(field, visibleAnswers));
          return (
            <section key={item.id} className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Раздел {item.number}</p><h2 className="mt-2 text-2xl font-bold text-slate-900">{item.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p></div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${completed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{completed ? "Проверен" : "Не завершён"}</span>
              </div>
              {fields.length ? <div className="mt-6 grid gap-5 md:grid-cols-2">{fields.map((field) => <ReadOnlyField key={field.id} field={field} value={state.answers[field.id]} />)}</div> : null}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-8 flex min-w-0 flex-col gap-5 sm:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Постепенно соберём сведения, необходимые для подготовки дела.</p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {pendingKey ? <span role="status">Сохраняем изменения…</span> : "Изменения сохранены"}
        </span>
      </div>

      {error ? <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-6">
        <QuestionnaireSectionNav
          currentId={section.id}
          completedCount={completedCount}
          progress={progress}
          isCompleted={(id) => completedSet.has(id)}
          onSelect={goTo}
        />

        <main className="min-w-0">
          <PlatformCard className="min-w-0 overflow-hidden p-5 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Раздел {section.number} из {QUESTIONNAIRE_SECTIONS.length}</p>
            <h2 className="mt-3 break-words text-2xl font-semibold tracking-[-.04em] sm:mt-4 sm:text-4xl">{section.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{section.description}</p>

            {isReview ? (
              <div className="mt-6 space-y-4 sm:mt-8">
                <div className="rounded-2xl bg-muted p-4 text-sm leading-6 text-muted-foreground sm:p-5">
                  Проверьте предыдущие разделы. Система завершит анкету только после серверной проверки обязательных полей и подтверждения всех разделов.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {QUESTIONNAIRE_SECTIONS.filter((item) => !item.review).map((item) => (
                    <button key={item.id} type="button" onClick={() => goTo(item.id)} className="min-h-11 rounded-xl border border-border bg-background px-4 py-3 text-left text-sm transition hover:bg-muted">
                      <span className="font-semibold">{item.number}. {item.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{completedSet.has(item.id) ? "Раздел подтверждён" : "Требует подтверждения"}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : visibleFields.length ? (
              <div className="mt-6 flex min-w-0 flex-col gap-6 sm:mt-8 sm:gap-7">
                {visibleFields.map((field) => (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    value={drafts[field.id]}
                    disabled={state.status === "COMPLETED" || Boolean(pendingKey)}
                    pending={pendingKey === `field:${field.id}`}
                    onChange={(value) => setDrafts((previous) => ({ ...previous, [field.id]: value }))}
                    onSave={() => saveField(field)}
                  />
                ))}
                {section.id === "mortgage" && state.answers.hasMortgage === true ? <MortgageCapability plan={planCode} /> : null}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-muted p-4 sm:mt-8 sm:p-5"><p className="font-medium">Этот раздел не применяется</p><p className="mt-2 text-sm text-muted-foreground">По предыдущим ответам дополнительные сведения здесь не требуются.</p></div>
            )}

            {state.status !== "COMPLETED" ? (
              <div className="mt-8 flex min-w-0 flex-col-reverse gap-3 border-t border-border pt-5 sm:mt-10 sm:flex-row sm:justify-between sm:pt-6">
                <Button variant="outline" className="h-11 w-full rounded-full sm:w-auto" disabled={index === 0 || Boolean(pendingKey)} onClick={() => goTo(QUESTIONNAIRE_SECTIONS[index - 1].id)}>Назад</Button>
                {isReview ? (
                  <Button className="h-auto min-h-11 w-full whitespace-normal rounded-full px-5 py-3 text-center sm:w-auto" onClick={completeQuestionnaire} disabled={Boolean(pendingKey)} aria-busy={pendingKey === "complete"}>
                    {pendingKey === "complete" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                    {pendingKey === "complete" ? <span role="status">Завершаем…</span> : "Завершить анкету"}
                  </Button>
                ) : (
                  <Button className="h-auto min-h-11 w-full whitespace-normal rounded-full px-5 py-3 text-center sm:w-auto" onClick={() => completeSection(section.id)} disabled={Boolean(pendingKey)} aria-busy={pendingKey === `section:${section.id}`}>
                    {pendingKey === `section:${section.id}` ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                    {pendingKey === `section:${section.id}` ? <span role="status">Проверяем…</span> : completedSet.has(section.id) ? "Проверить и продолжить" : "Сохранить и продолжить"}
                    {pendingKey !== `section:${section.id}` ? <ArrowRight data-icon="inline-end" /> : null}
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-8 flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />Анкета завершена и больше не принимает изменения.
              </div>
            )}
          </PlatformCard>
        </main>
      </div>
    </div>
  );
}

function FieldEditor({ field, value, disabled, pending, onChange, onSave }: {
  field: QuestionnaireField;
  value: DraftValue | undefined;
  disabled: boolean;
  pending: boolean;
  onChange: (value: DraftValue) => void;
  onSave: () => void;
}) {
  const inputClass = "mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:bg-muted disabled:text-muted-foreground";

  return (
    <div className="min-w-0">
      <label className="text-sm font-semibold text-foreground">{field.label}{field.required ? <span className="ml-1 text-primary">*</span> : null}</label>
      {field.type === "yes-no" ? (
        <div className="mt-2 flex gap-2">
          {[true, false].map((option) => <button key={String(option)} type="button" disabled={disabled} onClick={() => onChange(option)} className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${value === option ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground"}`}>{option ? "Да" : "Нет"}</button>)}
        </div>
      ) : field.type === "select" || field.type === "radio" ? (
        <select value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={inputClass}><option value="">Выберите вариант</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      ) : field.type === "textarea" ? (
        <textarea value={typeof value === "string" ? value : ""} disabled={disabled} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} className={`${inputClass} min-h-28 py-3`} />
      ) : (
        <input type={field.type === "date" ? "date" : field.type === "number" || field.type === "currency" ? "number" : "text"} min={field.type === "number" || field.type === "currency" ? 0 : undefined} value={typeof value === "boolean" ? "" : value ?? ""} disabled={disabled} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      )}
      {field.hint ? <p className="mt-1.5 text-xs text-muted-foreground">{field.hint}</p> : null}
      {!disabled ? (
        <button type="button" onClick={onSave} className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-busy={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Save className="size-3.5" aria-hidden="true" />}
          {pending ? <span role="status">Сохраняем…</span> : "Сохранить поле"}
        </button>
      ) : null}
    </div>
  );
}

function ReadOnlyField({ field, value }: { field: QuestionnaireField; value: QuestionnaireAnswer | undefined }) {
  const display = value === undefined || value === "" ? "—" : typeof value === "boolean" ? (value ? "Да" : "Нет") : String(value);
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{field.label}</p><p className="mt-2 break-words text-sm font-semibold text-slate-800">{display}</p></div>;
}

function toDrafts(answers: QuestionnaireAnswers): Record<string, DraftValue> {
  const drafts: Record<string, DraftValue> = {};
  for (const [fieldId, answer] of Object.entries(answers)) drafts[fieldId] = typeof answer === "number" ? String(answer) : answer;
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
