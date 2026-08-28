"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import {
  QUESTIONNAIRE_SECTIONS,
  isQuestionnaireFieldVisible,
} from "@/lib/platform/questionnaire-content";
import type {
  QuestionnaireAnswer,
  QuestionnaireAnswers,
  QuestionnaireField,
} from "@/lib/platform/types";

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
  initialState,
}: {
  caseId: string;
  canEdit: boolean;
  initialState: QuestionnaireState | null;
}) {
  const [state, setState] = useState<QuestionnaireState | null>(initialState);
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>(() => toDrafts(initialState?.answers ?? {}));
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleAnswers = useMemo(() => state?.answers ?? {}, [state?.answers]);

  function applyState(next: QuestionnaireState) {
    setState(next);
    setDrafts(toDrafts(next.answers));
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
        body: JSON.stringify({
          fieldId: field.id,
          value,
          expectedVersion: state.version,
        }),
      });
      const result = (await response.json()) as ApiResult;
      if (!result.ok) {
        if (response.status === 409) {
          await handleConflict(result);
          return;
        }
        if (result.error.code === "INVALID_INPUT") {
          setError("Сервер отклонил значение поля. Проверьте формат данных.");
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
    } catch {
      setError("Не удалось завершить раздел. Проверьте обязательные поля.");
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
      <div className="mt-8 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 p-6">
        <p className="font-semibold text-slate-900">Анкета ещё не создана</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          После начала ответы будут храниться в PostgreSQL в рамках этого дела. Данные браузера не являются источником истины.
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={start}
            disabled={Boolean(pendingKey)}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#17202a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingKey === "start" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pendingKey === "start" ? "Создаём…" : "Начать заполнение"}
          </button>
        ) : (
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Режим просмотра</p>
        )}
        {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      </div>
    );
  }

  const completedSet = new Set(state.completedSectionIds);

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-100 bg-slate-50/70 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Серверное состояние</p>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {state.status === "COMPLETED" ? "Анкета завершена" : `${completedSet.size} из ${QUESTIONNAIRE_SECTIONS.length} разделов`}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">v{state.version}</span>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {QUESTIONNAIRE_SECTIONS.map((section) => {
        const completed = completedSet.has(section.id);
        const visibleFields = section.fields.filter((field) => isQuestionnaireFieldVisible(field, visibleAnswers));

        return (
          <section key={section.id} className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Раздел {section.number}</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{section.description}</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${completed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {completed ? "Проверен" : "Не завершён"}
              </span>
            </div>

            {visibleFields.length ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {visibleFields.map((field) => (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    value={drafts[field.id]}
                    disabled={!canEdit || state.status === "COMPLETED" || Boolean(pendingKey)}
                    pending={pendingKey === `field:${field.id}`}
                    onChange={(value) => setDrafts((previous) => ({ ...previous, [field.id]: value }))}
                    onSave={() => saveField(field)}
                  />
                ))}
              </div>
            ) : section.review ? (
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm leading-6 text-slate-500">
                Итоговый раздел подтверждает, что предыдущие разделы проверены. Сервер повторно проверит обязательные поля перед окончательным завершением анкеты.
              </div>
            ) : null}

            {canEdit && state.status !== "COMPLETED" ? (
              <button
                type="button"
                onClick={() => completeSection(section.id)}
                disabled={Boolean(pendingKey)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingKey === `section:${section.id}` ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                {pendingKey === `section:${section.id}` ? "Проверяем…" : completed ? "Проверить раздел снова" : "Завершить раздел"}
              </button>
            ) : null}
          </section>
        );
      })}

      {canEdit && state.status !== "COMPLETED" ? (
        <button
          type="button"
          onClick={completeQuestionnaire}
          disabled={Boolean(pendingKey)}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#17202a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#263342] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingKey === "complete" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
          {pendingKey === "complete" ? "Завершаем…" : "Завершить анкету"}
        </button>
      ) : null}

      {state.status === "COMPLETED" ? (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="size-5" aria-hidden="true" />
          Анкета завершена и больше не принимает изменения.
        </div>
      ) : null}
    </div>
  );
}

function FieldEditor({
  field,
  value,
  disabled,
  pending,
  onChange,
  onSave,
}: {
  field: QuestionnaireField;
  value: DraftValue | undefined;
  disabled: boolean;
  pending: boolean;
  onChange: (value: DraftValue) => void;
  onSave: () => void;
}) {
  const inputClass = "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">
        {field.label}{field.required ? <span className="ml-1 text-[#7B2330]">*</span> : null}
      </label>

      {field.type === "yes-no" ? (
        <div className="mt-2 flex gap-2">
          {[true, false].map((option) => (
            <button
              key={String(option)}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${value === option ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700"}`}
            >
              {option ? "Да" : "Нет"}
            </button>
          ))}
        </div>
      ) : field.type === "select" || field.type === "radio" ? (
        <select
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        >
          <option value="">Выберите вариант</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <textarea
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} min-h-28 py-3`}
        />
      ) : (
        <input
          type={field.type === "date" ? "date" : field.type === "number" || field.type === "currency" ? "number" : "text"}
          min={field.type === "number" || field.type === "currency" ? 0 : undefined}
          value={typeof value === "boolean" ? "" : value ?? ""}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}

      {field.hint ? <p className="mt-1.5 text-xs text-slate-400">{field.hint}</p> : null}

      {!disabled ? (
        <button
          type="button"
          onClick={onSave}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 transition hover:text-slate-900"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Save className="size-3.5" aria-hidden="true" />}
          {pending ? "Сохраняем…" : "Сохранить поле"}
        </button>
      ) : null}
    </div>
  );
}

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
