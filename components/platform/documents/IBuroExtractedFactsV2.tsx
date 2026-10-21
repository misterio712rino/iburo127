"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CircleAlert, FileSearch, Loader2, X } from "lucide-react";

type Candidate = {
  id: string;
  sourceFileId: string;
  fieldPath: string;
  recordKey: string;
  sourcePage: number;
  value: unknown;
  confidence: number;
  reviewStatus: "NEEDS_REVIEW" | "CONFIRMED" | "REJECTED";
  reviewedAt: string | null;
  sourceFile: { fileName: string };
};
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string } };
type DownloadResult = { url: string; expiresAt: string };
type ProcessingSummary = {
  fileId: string;
  fileStatus: string;
  processingStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | null;
  pageCount: number | null;
};

async function fetchReviewData(caseId: string) {
  const [factsResponse, processingResponse] = await Promise.all([
    fetch(`/api/platform/cases/${caseId}/extracted-facts`, { cache: "no-store" }),
    fetch(`/api/platform/cases/${caseId}/document-processing`, { cache: "no-store" }),
  ]);
  const [factsResult, processingResult] = await Promise.all([
    factsResponse.json() as Promise<ApiResult<Candidate[]>>,
    processingResponse.json() as Promise<ApiResult<ProcessingSummary[]>>,
  ]);
  if (!factsResult.ok) throw new Error(factsResult.error.code);
  if (!processingResult.ok) throw new Error(processingResult.error.code);
  return { candidates: factsResult.data, processing: processingResult.data };
}

const FIELD_LABELS: Record<string, string> = {
  "subject.fullName": "ФИО",
  "subject.birthDate": "Дата рождения",
  "income.monthlyAmount": "Ежемесячный доход по документу",
  "creditors.amountTotal": "Общая сумма задолженности",
  "creditors.creditorName": "Наименование кредитора",
  "creditors.claimAmountUnclassified": "Сумма задолженности по документу",
  "assets.description": "Описание объекта имущества",
  "assets.address": "Адрес / место нахождения",
  "assets.ownership": "Вид / доля собственности",
  "assets.pledgee": "Залогодержатель",
  "assets.valueUnclassified": "Стоимость объекта по документу",
};

function recordLabel(recordKey: string) {
  const match = /^(creditor|asset)-p(\d+)-r(\d+)$/.exec(recordKey);
  if (!match) return null;
  const noun = match[1] === "creditor" ? "Кредитор" : "Имущество";
  return `${noun}: страница ${match[2]}, запись № ${match[3]}`;
}

function formatValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Значение распознано в неизвестном формате";
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === "TEXT" && typeof candidate.text === "string") return candidate.text;
  if (candidate.kind === "DATE" && typeof candidate.isoDate === "string") {
    const [year, month, day] = candidate.isoDate.split("-");
    return `${day}.${month}.${year}`;
  }
  if (candidate.kind === "MONEY" && typeof candidate.amountMinorUnits === "string") {
    try {
      return `${(Number(BigInt(candidate.amountMinorUnits)) / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
    } catch {
      return "Сумму не удалось отобразить";
    }
  }
  return "Значение распознано в неизвестном формате";
}

export function IBuroExtractedFactsV2({ caseId }: { caseId: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [sourceUrls, setSourceUrls] = useState<Record<string, DownloadResult>>({});
  const [loading, setLoading] = useState(true);
  const [processingPending, setProcessingPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (preserveEdits = false) => {
    const data = await fetchReviewData(caseId);
    setCandidates(data.candidates);
    setEdits((previous) => Object.fromEntries(data.candidates.map((candidate) => [
      candidate.id,
      preserveEdits && Object.hasOwn(previous, candidate.id)
        ? previous[candidate.id]
        : editableValue(candidate.value),
    ])));
    setProcessingPending(data.processing.some((job) =>
      job.processingStatus === "PENDING" || job.processingStatus === "PROCESSING",
    ));
  }, [caseId]);

  useEffect(() => {
    let active = true;
    fetchReviewData(caseId)
      .then((data) => {
        if (!active) return;
        setCandidates(data.candidates);
        setEdits(Object.fromEntries(data.candidates.map((candidate) => [candidate.id, editableValue(candidate.value)])));
        setProcessingPending(data.processing.some((job) => job.processingStatus === "PENDING" || job.processingStatus === "PROCESSING"));
      })
      .catch(() => { if (active) setError("Не удалось загрузить распознанные значения."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [caseId]);

  useEffect(() => {
    if (!processingPending) return;
    const timer = window.setInterval(() => {
      void refresh(true).catch(() => setError("Не удалось обновить статус обработки документов."));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [processingPending, refresh]);

  useEffect(() => {
    if (Object.keys(sourceUrls).length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sourceUrls]);

  async function decide(candidate: Candidate, decision: "CONFIRMED" | "REJECTED") {
    if (pending) return;
    setPending(candidate.id);
    setError(null);
    try {
      const editedValue = decision === "CONFIRMED" ? parseEditableValue(candidate.value, edits[candidate.id] ?? "") : undefined;
      if (decision === "CONFIRMED" && editedValue === null) {
        setError("Проверьте формат значения и исправьте его перед подтверждением.");
        setPending(null);
        return;
      }
      const unchanged = edits[candidate.id] === editableValue(candidate.value);
      const payload = { factId: candidate.id, decision, ...(!unchanged && editedValue !== undefined ? { value: editedValue } : {}) };
      const response = await fetch(`/api/platform/cases/${caseId}/extracted-facts`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResult<unknown>;
      if (!result.ok) {
        if (response.status === 409) {
          await refresh();
          setError("Значение уже проверено в другой вкладке. Список обновлён.");
          return;
        }
        throw new Error(result.error.code);
      }
      await refresh();
    } catch {
      setError("Не удалось сохранить проверку значения. Повторите попытку.");
    } finally {
      setPending(null);
    }
  }

  async function getSourceUrl(candidate: Candidate) {
    setError(null);
    try {
      const response = await fetch(`/api/platform/files/${candidate.sourceFileId}/download`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({}),
      });
      const result = (await response.json()) as ApiResult<DownloadResult>;
      if (!result.ok) throw new Error(result.error.code);
      setSourceUrls((previous) => ({ ...previous, [candidate.id]: result.data }));
    } catch {
      setError("Не удалось получить защищённую ссылку на исходный файл.");
    }
  }

  const pendingReviewCount = candidates.filter((candidate) => candidate.reviewStatus === "NEEDS_REVIEW").length;
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 sm:p-7" aria-labelledby="extracted-facts-title">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800"><FileSearch className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="extracted-facts-title" className="text-lg font-semibold text-slate-900">Проверьте распознанные данные</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Это предварительное распознавание документов. Сверьте каждое значение с указанным файлом и страницей. Подтверждение пока не заполняет черновики документов.</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{pendingReviewCount} на проверке</span>
      </div>
      {error ? <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
      {loading ? <p className="mt-5 flex items-center gap-2 text-sm text-slate-600" role="status"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Загружаем результаты распознавания…</p> : null}
      {!loading && candidates.length === 0 ? <p className="mt-5 text-sm text-slate-600">Пока нет распознанных значений. Загрузите документы в разделе «Файлы» и дождитесь окончания обработки.</p> : null}
      {!loading && processingPending ? <p className="mt-3 text-sm text-slate-600" role="status">Документы ещё обрабатываются. Список обновится автоматически.</p> : null}
      <div className="mt-5 grid gap-3">
        {candidates.map((candidate) => {
          const needsReview = candidate.reviewStatus === "NEEDS_REVIEW";
          const title = FIELD_LABELS[candidate.fieldPath] ?? "Распознанное значение";
          const linkedRecordLabel = recordLabel(candidate.recordKey);
          return (
            <article key={candidate.id} className="rounded-2xl border border-white bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                  {linkedRecordLabel ? <p className="mt-0.5 text-xs text-slate-500">{linkedRecordLabel}</p> : null}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${needsReview ? "bg-amber-100 text-amber-900" : candidate.reviewStatus === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                  {needsReview ? "Нужно проверить" : candidate.reviewStatus === "CONFIRMED" ? "Подтверждено" : "Отклонено"}
                </span>
              </div>
              <p className="mt-3 break-words text-base font-medium text-slate-800">{formatValue(candidate.value)}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><CircleAlert className="size-3.5" aria-hidden="true" />Источник: {candidate.sourceFile.fileName}, страница {candidate.sourcePage}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {sourceUrls[candidate.id] && Date.parse(sourceUrls[candidate.id].expiresAt) > now
                  ? <><a className="font-semibold text-blue-800 underline underline-offset-2" href={sourceUrls[candidate.id].url} target="_blank" rel="noreferrer" onClick={(event) => {
                    if (Date.parse(sourceUrls[candidate.id].expiresAt) <= Date.now()) {
                      event.preventDefault();
                      void getSourceUrl(candidate);
                    }
                  }}>Открыть исходный файл</a><span className="text-xs text-slate-500">Ссылка действует до {new Date(sourceUrls[candidate.id].expiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span></>
                  : <button type="button" onClick={() => getSourceUrl(candidate)} className="min-h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">{sourceUrls[candidate.id] ? "Обновить защищённую ссылку" : "Получить защищённую ссылку"}</button>}
              </div>
              {needsReview ? <div className="mt-4 flex flex-wrap gap-2">
                <label className="sr-only" htmlFor={`fact-edit-${candidate.id}`}>Исправить: {title}</label>
                <input
                  id={`fact-edit-${candidate.id}`}
                  type={inputType(candidate.value)}
                  inputMode={isMoney(candidate.value) ? "decimal" : undefined}
                  value={edits[candidate.id] ?? editableValue(candidate.value)}
                  onChange={(event) => setEdits((previous) => ({ ...previous, [candidate.id]: event.target.value }))}
                  disabled={Boolean(pending)}
                  className="min-h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50"
                />
                <button type="button" onClick={() => decide(candidate, "CONFIRMED")} disabled={Boolean(pending)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60" aria-busy={pending === candidate.id}><Check className="size-4" aria-hidden="true" />{pending === candidate.id ? "Сохраняем…" : "Подтвердить"}</button>
                <button type="button" onClick={() => decide(candidate, "REJECTED")} disabled={Boolean(pending)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" aria-busy={pending === candidate.id}><X className="size-4" aria-hidden="true" />Отклонить</button>
              </div> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMoney(value: unknown): value is Record<string, unknown> & { kind: "MONEY"; amountMinorUnits: string } {
  return isRecord(value) && value.kind === "MONEY" && typeof value.amountMinorUnits === "string";
}

function inputType(value: unknown): "text" | "date" {
  return isRecord(value) && value.kind === "DATE" ? "date" : "text";
}

function editableValue(value: unknown) {
  if (!isRecord(value)) return "";
  if (value.kind === "TEXT" && typeof value.text === "string") return value.text;
  if (value.kind === "DATE" && typeof value.isoDate === "string") return value.isoDate;
  if (isMoney(value)) {
    const amount = value.amountMinorUnits;
    const padded = amount.padStart(3, "0");
    return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
  }
  return "";
}

function parseEditableValue(original: unknown, raw: string): unknown | null {
  if (!isRecord(original)) return null;
  if (original.kind === "TEXT") {
    const text = raw.trim();
    return text.length > 0 && text.length <= 2_000 && !text.includes("\0") ? { kind: "TEXT", text } : null;
  }
  if (original.kind === "DATE") {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00.000Z`) : null;
    return date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw
      ? { kind: "DATE", isoDate: raw }
      : null;
  }
  if (original.kind === "MONEY") {
    const normalized = raw.trim().replace(",", ".");
    if (!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(normalized)) return null;
    const [whole, fraction = ""] = normalized.split(".");
    return {
      kind: "MONEY",
      amountMinorUnits: (BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"))).toString(),
      currency: "RUB",
      asOfDate: typeof original.asOfDate === "string" ? original.asOfDate : null,
    };
  }
  return null;
}
