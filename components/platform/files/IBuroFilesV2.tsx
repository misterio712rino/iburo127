"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileCheck2,
  FileClock,
  FileLock2,
  FileWarning,
  Loader2,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { inferUploadMimeType, UPLOAD_ACCEPT_ATTRIBUTE } from "@/lib/platform/files/upload-types";

type StoredFileStatus =
  | "PENDING_UPLOAD"
  | "PENDING_SCAN"
  | "SCANNING"
  | "READY"
  | "QUARANTINED"
  | "SCAN_FAILED";

type StoredFileView = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
  status: StoredFileStatus;
  readyAt: string | null;
  createdAt: string;
};

type DocumentProcessingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
type DocumentProcessingView = {
  fileId: string;
  fileStatus: StoredFileStatus;
  processingStatus: DocumentProcessingStatus | null;
  pageCount: number | null;
};

type ApiFailure = { ok: false; error: { code: string } };
type ApiSuccess<T> = { ok: true; data: T };
type ApiResult<T> = ApiSuccess<T> | ApiFailure;

type PreparedUpload = {
  fileId: string;
  uploadUrl: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
};

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ACCEPT = UPLOAD_ACCEPT_ATTRIBUTE;

function getUploadFailureMessage(code: string | null, failedCount: number) {
  if (failedCount === 1 && code === "STAGING_BACKEND_DISABLED") {
    return "В этой Preview-сборке серверная загрузка отключена. Чтобы проверить сохранение файла, откройте приложение на Timeweb staging.";
  }
  if (failedCount === 1 && code === "OBJECT_UPLOAD_FAILED") {
    return "Файл выбран, но хранилище не приняло его. Проверьте подключение хранилища и повторите попытку.";
  }
  if (failedCount === 1 && (code === "INVALID_INPUT" || code === "UNSUPPORTED_FILE_TYPE")) {
    return "Формат не поддерживается или размер файла превышает 50 МБ.";
  }
  return `Не удалось загрузить ${failedCount} файл(а). Проверьте, что формат поддерживается и размер не превышает 50 МБ; если это так, проверьте соединение с хранилищем и повторите попытку.`;
}

function formatSize(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusPresentation(status: StoredFileStatus) {
  switch (status) {
    case "READY":
      return {
        label: "Проверен",
        description: "Файл прошёл проверку безопасности и доступен для скачивания.",
        className: "border-emerald-200/70 bg-emerald-50/70 text-emerald-700",
        icon: FileCheck2,
      };
    case "PENDING_SCAN":
    case "SCANNING":
      return {
        label: "На проверке",
        description: "Файл загружен в дело и ожидает завершения проверки безопасности.",
        className: "border-amber-200/80 bg-amber-50/80 text-amber-800",
        icon: FileClock,
      };
    case "SCAN_FAILED":
      return {
        label: "Проверка не завершена",
        description: "Файл сохранён, но проверку безопасности завершить не удалось. Скачивание пока недоступно.",
        className: "border-slate-200 bg-slate-100 text-slate-700",
        icon: FileWarning,
      };
    case "QUARANTINED":
      return {
        label: "Отклонён проверкой",
        description: "Файл изолирован системой безопасности и недоступен для скачивания.",
        className: "border-red-200 bg-red-50 text-red-700",
        icon: FileWarning,
      };
    case "PENDING_UPLOAD":
    default:
      return {
        label: "Загружается",
        description: "Загрузка файла ещё не завершена.",
        className: "border-slate-200 bg-slate-100 text-slate-600",
        icon: FileClock,
      };
  }
}

function getProcessingPresentation(status: DocumentProcessingStatus | null) {
  switch (status) {
    case "PROCESSING":
      return { label: "Распознаётся", description: "Извлекаем текст из документа.", className: "text-indigo-700", icon: Loader2 };
    case "COMPLETED":
      return { label: "Текст распознан", description: "Распознанный текст пока не используется для заполнения фактов или подготовки черновиков.", className: "text-emerald-700", icon: FileCheck2 };
    case "FAILED":
      return { label: "Не распознан", description: "Не удалось извлечь текст. Файл останется в деле; потребуется повторная обработка.", className: "text-red-700", icon: FileWarning };
    case "CANCELLED":
      return { label: "Обработка отменена", description: "Файл не был передан на распознавание.", className: "text-slate-600", icon: FileWarning };
    case "PENDING":
    default:
      return { label: "Ожидает распознавания", description: "Файл прошёл проверку безопасности и ожидает обработки.", className: "text-amber-700", icon: FileClock };
  }
}

export function IBuroFilesV2({ caseId, initialFiles }: { caseId: string; initialFiles: StoredFileView[] }) {
  const [files, setFiles] = useState(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processingByFileId, setProcessingByFileId] = useState<Record<string, DocumentProcessingView>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  async function refreshFiles() {
    const response = await fetch(`/api/platform/cases/${caseId}/files`, { method: "GET", cache: "no-store" });
    const result = (await response.json()) as ApiResult<StoredFileView[]>;
    if (!result.ok) throw new Error(result.error.code);
    setFiles(result.data);
  }

  useEffect(() => {
    if (files.length === 0) return;
    let disposed = false;
    let timer: number | undefined;

    async function refreshProcessing() {
      let shouldContinue = false;
      try {
        const response = await fetch(`/api/platform/cases/${caseId}/document-processing`, {
          method: "GET",
          cache: "no-store",
        });
        const result = (await response.json()) as ApiResult<DocumentProcessingView[]>;
        if (!result.ok) throw new Error(result.error.code);

        const nextStatuses = Object.fromEntries(result.data.map((item) => [item.fileId, item]));
        setProcessingByFileId(nextStatuses);
        setFiles((current) => current.map((file) => {
          const latest = nextStatuses[file.id] as DocumentProcessingView | undefined;
          return latest ? { ...file, status: latest.fileStatus } : file;
        }));
        shouldContinue = result.data.some((item) =>
          ["PENDING_UPLOAD", "PENDING_SCAN", "SCANNING"].includes(item.fileStatus) ||
          (item.fileStatus === "READY" && (item.processingStatus === null || item.processingStatus === "PENDING" || item.processingStatus === "PROCESSING")),
        );
      } catch {
        shouldContinue = true;
      }

      if (!disposed && shouldContinue) timer = window.setTimeout(() => void refreshProcessing(), 5000);
    }

    void refreshProcessing();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [caseId, files.length]);

  async function uploadOne(file: File) {
    const mimeType = inferUploadMimeType(file.name, file.type);
    if (!mimeType) throw new Error("UNSUPPORTED_FILE_TYPE");

    const prepareResponse = await fetch(`/api/platform/cases/${caseId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ fileName: file.name, mimeType, sizeBytes: file.size }),
    });
    const prepared = (await prepareResponse.json()) as ApiResult<PreparedUpload>;
    if (!prepared.ok) throw new Error(prepared.error.code);

    const putResponse = await fetch(prepared.data.uploadUrl, {
      method: "PUT",
      headers: prepared.data.requiredHeaders,
      body: file,
    });
    if (!putResponse.ok) throw new Error("OBJECT_UPLOAD_FAILED");

    const completeResponse = await fetch(`/api/platform/files/${prepared.data.fileId}/complete`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    const completed = (await completeResponse.json()) as ApiResult<StoredFileView>;
    if (!completed.ok) throw new Error(completed.error.code);
  }

  async function upload(selectedFiles: readonly File[]) {
    if (uploading || selectedFiles.length === 0) return;
    setError(null);
    setNotice(null);

    const validFiles = selectedFiles.filter(
      (file) => file.size > 0 && file.size <= MAX_UPLOAD_BYTES,
    );
    const invalidCount = selectedFiles.length - validFiles.length;
    if (validFiles.length === 0) {
      setError("Размер каждого файла должен быть от 1 байта до 50 МБ.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    let uploadedCount = 0;
    let failedCount = invalidCount;
    let lastFailureCode: string | null = null;
    try {
      for (const [index, file] of validFiles.entries()) {
        setUploadProgress({ current: index + 1, total: validFiles.length });
        try {
          await uploadOne(file);
          uploadedCount += 1;
        } catch (uploadError) {
          failedCount += 1;
          lastFailureCode = uploadError instanceof Error ? uploadError.message : null;
        }
      }

      await refreshFiles();
      if (uploadedCount > 0) {
        setNotice(
          `Загружено и отправлено на проверку безопасности: ${uploadedCount}. После проверки поддерживаемые файлы перейдут к распознаванию текста.`,
        );
      }
      if (failedCount > 0) {
        setError(getUploadFailureMessage(lastFailureCode, failedCount));
      }
    } catch {
      setError(
        uploadedCount > 0
          ? "Файлы загружены, но список не удалось обновить. Обновите страницу и проверьте статусы."
          : "Не удалось загрузить выбранные файлы. Проверьте соединение и повторите попытку.",
      );
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function download(fileId: string) {
    if (downloadingId || deletingId) return;
    setDownloadingId(fileId);
    setError(null);
    try {
      const response = await fetch(`/api/platform/files/${fileId}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ expiresInSeconds: 120 }),
      });
      const result = (await response.json()) as ApiResult<{ url: string; expiresAt: string }>;
      if (!result.ok) throw new Error(result.error.code);
      window.location.assign(result.data.url);
    } catch {
      setError("Не удалось подготовить защищённую ссылку на файл. Повторите попытку.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function remove(file: StoredFileView) {
    if (deletingId || downloadingId) return;
    if (file.status === "SCANNING") {
      setError("Файл сейчас проверяется. Дождитесь завершения проверки и повторите удаление.");
      return;
    }
    if (!window.confirm(`Удалить файл «${file.fileName}»? Это действие нельзя отменить.`)) return;

    setDeletingId(file.id);
    setError(null);
    try {
      const response = await fetch(`/api/platform/files/${file.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as ApiResult<{ fileId: string }>;
      if (!result.ok) {
        if (response.status === 409) {
          setError("Файл сейчас занят проверкой. Повторите удаление через несколько секунд.");
          return;
        }
        if (response.status === 403 || response.status === 404) {
          setError("Удалить этот файл нельзя или он уже удалён.");
          await refreshFiles();
          return;
        }
        throw new Error(result.error.code);
      }
      setFiles((current) => current.filter((item) => item.id !== result.data.fileId));
    } catch {
      setError("Не удалось удалить файл. Повторите попытку.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-7 py-1 sm:gap-9 sm:py-2">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--ib-plan-accent)]">Материалы дела</p>
          <h1 className="mt-2 font-[var(--font-iburo-display)] text-3xl font-semibold tracking-[-.04em] text-slate-950 sm:text-5xl">Файлы</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Загружайте PDF, фото и документы по делу. После проверки безопасности для поддерживаемых форматов запускается распознавание текста. Подготовка черновиков и подтверждение извлечённых данных по этому тексту пока не подключены.</p>
        </div>
        <span className="inline-flex min-h-9 w-fit items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Защищённое хранилище
        </span>
      </header>

      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</p> : null}

      <section className="relative overflow-hidden rounded-[26px] border border-[#e8e8e6] bg-white p-6 text-slate-950 shadow-[0_10px_34px_rgba(15,23,42,.04)] sm:p-8">
        <FileLock2 className="absolute -bottom-10 -right-8 size-56 text-[var(--ib-plan-accent)] opacity-[.035]" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--ib-plan-accent)]">Загрузить документы</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">Передайте документы в дело</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">Выберите PDF; фото JPG, PNG, WEBP, GIF, BMP, TIFF, HEIC/HEIF или AVIF; либо DOC/DOCX, RTF, ODT, TXT, CSV, XLS/XLSX, ODS, PPT/PPTX или ODP. До 50 МБ на файл. Файлы загрузятся по очереди.</p>
          </div>
          <label className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--ib-plan-accent)] bg-[var(--ib-plan-accent)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--ib-plan-accent-hover)] focus-within:ring-4 focus-within:ring-[var(--ib-plan-accent)]/15 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60">
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="size-4" aria-hidden="true" />}
            {uploading
              ? `Загрузка ${uploadProgress?.current ?? 1} из ${uploadProgress?.total ?? 1}…`
              : "Выбрать документы"}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              disabled={uploading}
              className="sr-only"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                if (selected.length > 0) void upload(selected);
              }}
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="case-files-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--ib-plan-accent)]">Хранилище</p>
            <h2 id="case-files-heading" className="mt-2 text-2xl font-semibold tracking-[-.04em] text-slate-950 sm:text-3xl">Файлы дела</h2>
          </div>
          <span aria-live="polite" className="text-xs font-semibold text-slate-400">{files.length} шт.</span>
        </div>

        {files.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {files.map((file) => {
              const status = getStatusPresentation(file.status);
              const StatusIcon = status.icon;
              const processing = file.status === "READY" ? getProcessingPresentation(processingByFileId[file.id]?.processingStatus ?? null) : null;
              const ProcessingIcon = processing?.icon;
              const canDownload = file.status === "READY";
              const canDelete = file.status !== "SCANNING";
              const busy = deletingId === file.id || downloadingId === file.id;

              return (
                <article key={file.id} className="group rounded-[24px] border border-[#e8e8e6] bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,.035)] transition-colors hover:bg-slate-50/40 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f4f1ef] text-[var(--ib-plan-accent)]"><StatusIcon className="size-5" aria-hidden="true" /></span>
                    <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                  </div>
                  <h3 className="mt-5 truncate text-lg font-semibold tracking-[-.025em] text-slate-950" title={file.fileName}>{file.fileName}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{status.description}</p>
                  {processing && ProcessingIcon ? (
                    <div className={`mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 ${processing.className}`} role="status">
                      <p className="flex items-center gap-2 text-xs font-semibold"><ProcessingIcon className={`size-4 ${processingByFileId[file.id]?.processingStatus === "PROCESSING" ? "animate-spin" : ""}`} aria-hidden="true" />{processing.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{processing.description}</p>
                    </div>
                  ) : null}
                  <dl className="mt-4 grid grid-cols-2 gap-4 text-xs">
                    <div className="min-w-0"><dt className="text-slate-400">Размер</dt><dd className="mt-1 font-semibold text-slate-700">{formatSize(file.sizeBytes)}</dd></div>
                    <div className="min-w-0"><dt className="text-slate-400">Добавлен</dt><dd className="mt-1 font-semibold text-slate-700">{formatDate(file.createdAt)}</dd></div>
                  </dl>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {canDownload ? (
                      <button
                        type="button"
                        onClick={() => download(file.id)}
                        disabled={Boolean(deletingId || downloadingId)}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ib-plan-accent)]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        {downloadingId === file.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
                        {downloadingId === file.id ? "Готовим ссылку…" : "Скачать"}
                      </button>
                    ) : (
                      <div className="inline-flex min-h-11 items-center rounded-xl bg-slate-50 px-4 text-xs font-semibold text-slate-500" role="status">
                        Скачивание станет доступно после проверки
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(file)}
                      disabled={!canDelete || Boolean(deletingId || downloadingId)}
                      aria-label={`Удалить файл ${file.fileName}`}
                      title={canDelete ? "Удалить файл" : "Дождитесь завершения проверки файла"}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:border-red-200 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/15 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                    >
                      {deletingId === file.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                      {deletingId === file.id ? "Удаление…" : "Удалить"}
                    </button>
                    {busy ? <span className="sr-only" role="status">Выполняется операция с файлом</span> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-8 text-center shadow-none">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-400"><FileLock2 className="size-5" aria-hidden="true" /></span>
            <h3 className="mt-4 font-semibold text-slate-900">Файлов пока нет</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">После загрузки материал сразу появится здесь со статусом проверки безопасности.</p>
          </div>
        )}
      </section>
    </div>
  );
}
