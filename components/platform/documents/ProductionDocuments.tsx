"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileText, Loader2, RefreshCw, Send } from "lucide-react";
import { DOCUMENT_DEFINITIONS } from "@/lib/platform/document-definitions";

type DocumentStatus =
  | "WAITING_DATA"
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "SENT_FOR_REVIEW"
  | "REVIEWED";

type DocumentView = {
  id: string;
  documentCode: string;
  status: DocumentStatus;
  regeneratedAt: string | null;
  sentForReviewAt: string | null;
  reviewedAt: string | null;
  version: number;
};

type ApiFailure = { ok: false; error: { code: string } };
type ApiSuccess<T> = { ok: true; data: T };
type ApiResult<T> = ApiSuccess<T> | ApiFailure;

const STATUS_LABELS: Record<DocumentStatus, string> = {
  WAITING_DATA: "Ожидает данные",
  DRAFT: "Черновик",
  READY_FOR_REVIEW: "Готов к проверке",
  SENT_FOR_REVIEW: "Передан на проверку",
  REVIEWED: "Проверен",
};

export function ProductionDocuments({
  caseId,
  canClientEdit,
  canReview,
  initialDocuments,
}: {
  caseId: string;
  canClientEdit: boolean;
  canReview: boolean;
  initialDocuments: DocumentView[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byCode = useMemo(
    () => new Map(documents.map((document) => [document.documentCode, document])),
    [documents],
  );

  async function refreshDocuments() {
    const response = await fetch(`/api/platform/cases/${caseId}/documents`, {
      method: "GET",
      cache: "no-store",
    });
    const result = (await response.json()) as ApiResult<DocumentView[]>;
    if (!result.ok) throw new Error(result.error.code);
    setDocuments(result.data);
  }

  async function mutate(
    documentCode: string,
    action: "create" | "regenerate" | "send" | "review",
  ) {
    if (pendingKey) return;
    const current = byCode.get(documentCode);
    const pending = `${documentCode}:${action}`;
    setPendingKey(pending);
    setError(null);

    const suffix =
      action === "create"
        ? ""
        : action === "regenerate"
          ? "/regenerate"
          : action === "send"
            ? "/send-for-review"
            : "/reviewed";

    try {
      const response = await fetch(
        `/api/platform/cases/${caseId}/documents/${documentCode}${suffix}`,
        {
          method: "POST",
          headers:
            action === "create"
              ? { Accept: "application/json" }
              : {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
          body:
            action === "create"
              ? undefined
              : JSON.stringify({ expectedVersion: current?.version }),
        },
      );
      const result = (await response.json()) as ApiResult<DocumentView>;

      if (!result.ok) {
        if (response.status === 409) {
          await refreshDocuments();
          setError(
            result.error.code === "VERSION_CONFLICT"
              ? "Документ изменился в другой вкладке. Состояние обновлено — повторите действие."
              : "Текущее состояние документа не позволяет выполнить это действие. Список обновлён.",
          );
          return;
        }
        throw new Error(result.error.code);
      }

      setDocuments((previous) => {
        const next = previous.filter((item) => item.documentCode !== documentCode);
        next.push(result.data);
        return next;
      });
    } catch {
      setError("Не удалось изменить состояние документа. Повторите попытку.");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {DOCUMENT_DEFINITIONS.map((definition) => {
          const document = byCode.get(definition.id);
          const pendingForDocument = pendingKey?.startsWith(`${definition.id}:`) ?? false;

          return (
            <article
              key={definition.id}
              className="rounded-[28px] border border-slate-200 bg-white/80 p-6"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600">
                  <FileText className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-6 text-slate-900">{definition.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{definition.description}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {document ? (
                  <>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      {STATUS_LABELS[document.status]}
                    </span>
                    <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">
                      v{document.version}
                    </span>
                  </>
                ) : (
                  <span className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-400">
                    Не создан
                  </span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {!document && canClientEdit ? (
                  <ActionButton
                    pending={pendingKey === `${definition.id}:create`}
                    disabled={Boolean(pendingKey)}
                    onClick={() => mutate(definition.id, "create")}
                    label="Создать черновик"
                    icon="create"
                  />
                ) : null}

                {document && canClientEdit && document.status !== "SENT_FOR_REVIEW" && document.status !== "REVIEWED" ? (
                  <ActionButton
                    pending={pendingKey === `${definition.id}:regenerate`}
                    disabled={Boolean(pendingKey)}
                    onClick={() => mutate(definition.id, "regenerate")}
                    label="Обновить по анкете"
                    icon="refresh"
                  />
                ) : null}

                {document && canClientEdit && document.status === "READY_FOR_REVIEW" ? (
                  <ActionButton
                    pending={pendingKey === `${definition.id}:send`}
                    disabled={Boolean(pendingKey)}
                    onClick={() => mutate(definition.id, "send")}
                    label="Передать на проверку"
                    icon="send"
                  />
                ) : null}

                {document && canReview && document.status === "SENT_FOR_REVIEW" ? (
                  <ActionButton
                    pending={pendingKey === `${definition.id}:review`}
                    disabled={Boolean(pendingKey)}
                    onClick={() => mutate(definition.id, "review")}
                    label="Отметить проверенным"
                    icon="review"
                  />
                ) : null}
              </div>

              {document?.status === "WAITING_DATA" ? (
                <p className="mt-4 text-xs leading-5 text-amber-700">
                  Для подготовки документа пока недостаточно данных анкеты.
                </p>
              ) : null}

              {document?.status === "REVIEWED" ? (
                <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Проверка специалистом завершена.
                </p>
              ) : null}

              {pendingForDocument ? (
                <span className="sr-only" aria-live="polite">Выполняется серверное действие</span>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ActionButton({
  pending,
  disabled,
  onClick,
  label,
  icon,
}: {
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  icon: "create" | "refresh" | "send" | "review";
}) {
  const Icon = icon === "refresh" ? RefreshCw : icon === "send" ? Send : icon === "review" ? CheckCircle2 : FileText;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Icon className="size-3.5" aria-hidden="true" />}
      {pending ? "Сохраняем…" : label}
    </button>
  );
}
