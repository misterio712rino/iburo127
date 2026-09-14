"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Files,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { PlatformCard, ProgressBar } from "@/components/platform/PlatformPrimitives";
import { buttonVariants } from "@/components/ui/button";
import { DOCUMENT_DEFINITIONS } from "@/lib/platform/document-definitions";
import { cn } from "@/lib/utils";

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

function staffReviewPriority(status: DocumentStatus | undefined) {
  if (status === "SENT_FOR_REVIEW") return 0;
  if (status === "READY_FOR_REVIEW") return 1;
  if (status === "DRAFT") return 2;
  if (status === "WAITING_DATA") return 3;
  if (status === "REVIEWED") return 4;
  return 5;
}

function clientStatusClass(status: DocumentStatus | undefined) {
  if (status === "REVIEWED") return "bg-emerald-50 text-emerald-700";
  if (status === "SENT_FOR_REVIEW") return "bg-sky-50 text-sky-700";
  if (status === "READY_FOR_REVIEW") return "bg-primary/10 text-primary";
  if (status === "WAITING_DATA") return "bg-amber-50 text-amber-700";
  return "bg-muted text-muted-foreground";
}

export function ProductionDocuments({
  caseId,
  canClientEdit,
  canReview,
  questionnaire,
  initialDocuments,
}: {
  caseId: string;
  canClientEdit: boolean;
  canReview: boolean;
  questionnaire: { completed: number; total: number; percent: number };
  initialDocuments: DocumentView[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byCode = useMemo(
    () => new Map(documents.map((document) => [document.documentCode, document])),
    [documents],
  );
  const reviewCount = useMemo(
    () => documents.filter((document) => document.status === "SENT_FOR_REVIEW").length,
    [documents],
  );
  const orderedDefinitions = useMemo(() => {
    if (!canReview) return [...DOCUMENT_DEFINITIONS];
    return [...DOCUMENT_DEFINITIONS].sort(
      (left, right) =>
        staffReviewPriority(byCode.get(left.id)?.status) -
        staffReviewPriority(byCode.get(right.id)?.status),
    );
  }, [byCode, canReview]);

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

  if (canClientEdit) {
    const prepared = documents.filter((document) =>
      document.status === "READY_FOR_REVIEW" ||
      document.status === "SENT_FOR_REVIEW" ||
      document.status === "REVIEWED",
    ).length;
    const drafts = documents.filter((document) => document.status === "DRAFT").length;
    const reviewed = documents.filter((document) => document.status === "REVIEWED").length;
    const title = prepared > 0
      ? `${prepared} ${prepared === 1 ? "документ подготовлен" : prepared < 5 ? "документа подготовлены" : "документов подготовлены"}`
      : documents.length > 0
        ? "Подготовка документов продолжается"
        : "Документы пока не сформированы";
    const description = questionnaire.percent < 100
      ? `Анкета заполнена на ${questionnaire.percent}%. По мере заполнения данных комплект документов будет становиться полнее.`
      : prepared > 0
        ? "Данные анкеты заполнены. Проверьте подготовленные материалы и передайте готовые документы специалисту."
        : "Данные анкеты заполнены. Можно начать формирование черновиков документов.";

    return (
      <div className="mt-8 flex min-w-0 flex-col gap-7 sm:gap-9">
        {error ? (
          <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
        ) : null}

        <PlatformCard className="relative min-w-0 overflow-hidden border-primary/30 bg-primary p-5 text-primary-foreground sm:p-8">
          <Files className="absolute -bottom-12 -right-8 size-56 opacity-[.07]" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[.16em] opacity-75">Подготовка документов</p>
            <h2 className="mt-5 max-w-3xl break-words text-3xl font-semibold tracking-[-.045em] sm:text-4xl">{title}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 opacity-80 sm:text-base">{description}</p>
            {documents.length === 0 && questionnaire.percent > 0 ? (
              <p className="mt-7 inline-flex items-center gap-2 text-sm font-semibold"><ArrowRight className="size-4" aria-hidden="true" />Создайте первый черновик в комплекте ниже</p>
            ) : null}
          </div>
        </PlatformCard>

        <section aria-labelledby="document-list-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="document-list-title" className="text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Комплект документов</h2>
              <p className="mt-2 text-sm text-muted-foreground">{drafts ? `${drafts} черновика подготовлены по имеющимся сведениям.` : "Статусы обновляются вместе с данными анкеты."}</p>
            </div>
            <p className="text-xs text-muted-foreground">{reviewed ? `Проверено специалистом: ${reviewed}` : "Черновики документов"}</p>
          </div>

          <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
            {DOCUMENT_DEFINITIONS.map((definition) => {
              const document = byCode.get(definition.id);
              const pendingForDocument = pendingKey?.startsWith(`${definition.id}:`) ?? false;
              const completeness = document?.status === "WAITING_DATA"
                ? Math.min(questionnaire.percent, 60)
                : document
                  ? Math.max(questionnaire.percent, 75)
                  : questionnaire.percent;

              return (
                <article key={definition.id} className="flex min-w-0 flex-col rounded-[1.4rem] border border-border bg-card p-5 text-card-foreground shadow-[0_14px_40px_rgba(0,0,0,.045)] sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted text-primary"><FileText className="size-5" aria-hidden="true" /></span>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${clientStatusClass(document?.status)}`}>{document ? STATUS_LABELS[document.status] : "Не создан"}</span>
                      {document && canClientEdit ? (
                        <span className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">v{document.version}</span>
                      ) : null}
                    </div>
                  </div>
                  <h3 className="mt-6 break-words text-lg font-semibold tracking-[-.025em]">{definition.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{definition.description}</p>
                  <div className="mt-6">
                    <div className="mb-2 flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Данные источника</span><span className="font-semibold">{completeness}%</span></div>
                    <ProgressBar value={completeness} />
                  </div>
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {!document ? (
                      <ClientActionButton pending={pendingKey === `${definition.id}:create`} disabled={Boolean(pendingKey)} onClick={() => mutate(definition.id, "create")} label="Создать черновик" icon="create" />
                    ) : null}
                    {document && document.status !== "SENT_FOR_REVIEW" && document.status !== "REVIEWED" ? (
                      <ClientActionButton pending={pendingKey === `${definition.id}:regenerate`} disabled={Boolean(pendingKey)} onClick={() => mutate(definition.id, "regenerate")} label="Обновить по анкете" icon="refresh" />
                    ) : null}
                    {document?.status === "READY_FOR_REVIEW" ? (
                      <ClientActionButton pending={pendingKey === `${definition.id}:send`} disabled={Boolean(pendingKey)} onClick={() => mutate(definition.id, "send")} label="Передать на проверку" icon="send" primary />
                    ) : null}
                  </div>
                  {document?.status === "WAITING_DATA" ? <p className="mt-4 text-xs leading-5 text-amber-700">Для подготовки документа пока недостаточно данных анкеты.</p> : null}
                  {document?.status === "SENT_FOR_REVIEW" ? <p className="mt-4 text-xs font-semibold text-sky-700">Документ находится у специалиста на проверке.</p> : null}
                  {document?.status === "REVIEWED" ? <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="size-4" aria-hidden="true" />Проверка специалистом завершена.</p> : null}
                  {pendingForDocument ? <span className="sr-only" role="status">Выполняется действие с документом</span> : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-2">
          <PlatformCard className="min-w-0 p-5 sm:p-6">
            <div className="flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><ClipboardCheck className="size-5" aria-hidden="true" /></span><div className="min-w-0"><h2 className="font-semibold">Данные анкеты</h2><p className="mt-2 text-sm text-muted-foreground">Заполнено {questionnaire.completed} из {questionnaire.total} разделов</p></div></div>
            <div className="mt-5"><ProgressBar value={questionnaire.percent} /></div>
            <Link href={`/portal/cases/${caseId}/questionnaire`} className={cn(buttonVariants({ variant: "outline" }), "mt-5 min-h-11 w-full rounded-full px-4 py-3 sm:w-auto")}>Открыть анкету<ArrowRight data-icon="inline-end" /></Link>
          </PlatformCard>
          <PlatformCard className="min-w-0 p-5 sm:p-6">
            <div className="flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><ShieldCheck className="size-5" aria-hidden="true" /></span><div className="min-w-0"><h2 className="font-semibold">Проверка специалистом</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Специалист iБюро проверит содержание перед использованием документов. Автоматически подготовленный черновик не является готовым судебным документом.</p></div></div>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><FileCheck2 className="size-4 text-primary" aria-hidden="true" />Следующий этап после вашей проверки</div>
          </PlatformCard>
        </section>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {error ? <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {canReview ? (
        <div className={`rounded-2xl border px-4 py-4 ${reviewCount > 0 ? "border-[#7B2330]/20 bg-[#7B2330]/[0.04]" : "border-emerald-200 bg-emerald-50/70"}`}>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Очередь проверки</p><p className="mt-1 text-lg font-bold text-slate-900">Ожидают проверки: {reviewCount}</p><p className="mt-1 text-sm leading-6 text-slate-600">{reviewCount > 0 ? "Переданные клиентом документы показаны первыми. Подтверждайте проверку после фактического просмотра документа." : "Новых документов, переданных клиентом на проверку, сейчас нет."}</p>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {orderedDefinitions.map((definition) => {
          const document = byCode.get(definition.id);
          const pendingForDocument = pendingKey?.startsWith(`${definition.id}:`) ?? false;
          const requiresReview = canReview && document?.status === "SENT_FOR_REVIEW";
          return (
            <article key={definition.id} className={`rounded-[28px] border bg-white/80 p-6 ${requiresReview ? "border-[#7B2330]/30 shadow-[0_12px_40px_rgba(123,35,48,0.08)]" : "border-slate-200"}`}>
              <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600"><FileText className="size-5" aria-hidden="true" /></span><div className="min-w-0"><p className="text-lg font-bold leading-6 text-slate-900">{definition.title}</p><p className="mt-2 text-sm leading-6 text-slate-500">{definition.description}</p></div></div>
              <div className="mt-5 flex flex-wrap items-center gap-2">{document ? <><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${requiresReview ? "bg-[#7B2330]/10 text-[#7B2330]" : "bg-slate-100 text-slate-700"}`}>{STATUS_LABELS[document.status]}</span></> : <span className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-400">Не создан</span>}</div>
              <div className="mt-5 flex flex-wrap gap-2">{document && canReview && document.status === "SENT_FOR_REVIEW" ? <ActionButton pending={pendingKey === `${definition.id}:review`} disabled={Boolean(pendingKey)} onClick={() => mutate(definition.id, "review")} label="Подтвердить проверку" icon="review" /> : null}</div>
              {document?.status === "WAITING_DATA" ? <p className="mt-4 text-xs leading-5 text-amber-700">Для подготовки документа пока недостаточно данных анкеты.</p> : null}
              {document?.status === "REVIEWED" ? <p className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="size-4" aria-hidden="true" />Проверка специалистом завершена.</p> : null}
              {pendingForDocument ? <span className="sr-only" aria-live="polite">Выполняется действие</span> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ClientActionButton({ pending, disabled, onClick, label, icon, primary = false }: { pending: boolean; disabled: boolean; onClick: () => void; label: string; icon: "create" | "refresh" | "send"; primary?: boolean }) {
  const Icon = icon === "refresh" ? RefreshCw : icon === "send" ? Send : FileText;
  return <button type="button" onClick={onClick} disabled={disabled} aria-busy={pending} className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-background text-foreground hover:bg-muted"}`}>{pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Icon className="size-3.5" aria-hidden="true" />}{pending ? <span role="status">Сохраняем…</span> : label}</button>;
}

function ActionButton({ pending, disabled, onClick, label, icon }: { pending: boolean; disabled: boolean; onClick: () => void; label: string; icon: "review" }) {
  const Icon = icon === "review" ? CheckCircle2 : FileText;
  return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">{pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Icon className="size-3.5" aria-hidden="true" />}{pending ? <span role="status">Сохраняем…</span> : label}</button>;
}
