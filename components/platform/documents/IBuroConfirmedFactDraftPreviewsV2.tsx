"use client";

import { useState } from "react";
import { FileCheck2, FileText, Loader2 } from "lucide-react";

type DocumentCode = "bankruptcy-application" | "property-inventory" | "creditors-list";
type Preview = { documentCode: DocumentCode; previewText: string; courtReady: false; facts: readonly unknown[] };
type ApiResult = { ok: true; data: Preview } | { ok: false; error: { code: string } };

const DOCUMENTS: readonly { code: DocumentCode; title: string }[] = [
  { code: "bankruptcy-application", title: "Заявление о банкротстве" },
  { code: "property-inventory", title: "Опись имущества" },
  { code: "creditors-list", title: "Список кредиторов" },
];

export function IBuroConfirmedFactDraftPreviewsV2({ caseId }: { caseId: string }) {
  const [pending, setPending] = useState<DocumentCode | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview(documentCode: DocumentCode) {
    if (pending) return;
    setPending(documentCode);
    setError(null);
    try {
      const response = await fetch(
        `/api/platform/cases/${caseId}/documents/${documentCode}/fact-preview`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as ApiResult;
      if (!result.ok) throw new Error(result.error.code);
      setPreview(result.data);
    } catch {
      setError("Не удалось подготовить сводку. Повторите попытку.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-5 sm:p-7" aria-labelledby="confirmed-facts-preview-title">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-100 text-indigo-800"><FileCheck2 className="size-5" aria-hidden="true" /></span>
        <div>
          <h2 id="confirmed-facts-preview-title" className="text-lg font-semibold text-slate-900">Сводки по подтверждённым данным</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Сводка включает только подтверждённые значения и ссылки на исходные страницы. Это проверочный материал, не готовый судебный документ.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {DOCUMENTS.map((document) => (
          <button
            key={document.code}
            type="button"
            onClick={() => void loadPreview(document.code)}
            disabled={pending !== null}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-950 transition hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60"
          >
            {pending === document.code ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
            {document.title}
          </button>
        ))}
      </div>
      {error ? <p className="mt-4 text-sm font-medium text-red-700" role="alert">{error}</p> : null}
      {preview ? (
        <div className="mt-5 rounded-2xl border border-indigo-100 bg-white p-4 sm:p-5">
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-800">{preview.previewText}</pre>
        </div>
      ) : null}
      {pending ? <span className="sr-only" role="status">Готовится сводка</span> : null}
    </section>
  );
}
