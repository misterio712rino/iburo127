"use client";

import { useRef, useState } from "react";
import {
  Download,
  FileCheck2,
  FileClock,
  FileLock2,
  FileWarning,
  Loader2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

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
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx";

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

export function IBuroFilesV2({ caseId, initialFiles }: { caseId: string; initialFiles: StoredFileView[] }) {
  const [files, setFiles] = useState(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refreshFiles() {
    const response = await fetch(`/api/platform/cases/${caseId}/files`, { method: "GET", cache: "no-store" });
    const result = (await response.json()) as ApiResult<StoredFileView[]>;
    if (!result.ok) throw new Error(result.error.code);
    setFiles(result.data);
  }

  async function upload(file: File) {
    if (uploading) return;
    setError(null);

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      setError("Размер файла должен быть от 1 байта до 50 МБ.");
      return;
    }

    setUploading(true);
    try {
      const prepareResponse = await fetch(`/api/platform/cases/${caseId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      const prepared = (await prepareResponse.json()) as ApiResult<PreparedUpload>;
      if (!prepared.ok) {
        if (prepared.error.code === "INVALID_INPUT") {
          setError("Этот тип файла не поддерживается или файл превышает допустимый размер.");
          return;
        }
        throw new Error(prepared.error.code);
      }

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
      if (!completed.ok) {
        if (completeResponse.status === 409) {
          setError("Файл загружен, но подтверждение загрузки ещё не завершено. Повторите попытку через несколько секунд.");
          return;
        }
        throw new Error(completed.error.code);
      }

      await refreshFiles();
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError("Не удалось загрузить файл. Проверьте соединение и повторите попытку.");
    } finally {
      setUploading(false);
    }
  }

  async function download(fileId: string) {
    if (downloadingId) return;
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

  return (
    <div className="flex min-w-0 flex-col gap-7 py-1 sm:gap-9 sm:py-2">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#b9202b]">Материалы дела</p>
          <h1 className="mt-2 font-[var(--font-iburo-display)] text-3xl font-semibold tracking-[-.04em] text-slate-950 sm:text-5xl">Файлы</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Загружайте документы и изображения по делу. Сразу после загрузки вы увидите файл здесь, а скачать его можно будет после проверки безопасности.</p>
        </div>
        <span className="inline-flex min-h-9 w-fit items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Защищённое хранилище
        </span>
      </header>

      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}

      <section className="relative overflow-hidden rounded-[26px] border border-[#e8e8e6] bg-white p-6 text-slate-950 shadow-[0_10px_34px_rgba(15,23,42,.04)] sm:p-8">
        <FileLock2 className="absolute -bottom-10 -right-8 size-56 text-[#b9202b] opacity-[.035]" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#b9202b]">Добавить материал</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">Передайте файл в дело</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">PDF, JPG, PNG, WEBP, DOC или DOCX до 50 МБ. После загрузки материал появится в списке со статусом проверки.</p>
          </div>
          <label className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#b9202b] bg-[#b9202b] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#9f1923] focus-within:ring-4 focus-within:ring-[#b9202b]/15 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60">
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="size-4" aria-hidden="true" />}
            {uploading ? "Загрузка…" : "Выбрать файл"}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              disabled={uploading}
              className="sr-only"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) void upload(selected);
              }}
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="case-files-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#b9202b]">Хранилище</p>
            <h2 id="case-files-heading" className="mt-2 text-2xl font-semibold tracking-[-.04em] text-slate-950 sm:text-3xl">Файлы дела</h2>
          </div>
          <span aria-live="polite" className="text-xs font-semibold text-slate-400">{files.length} шт.</span>
        </div>

        {files.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {files.map((file) => {
              const status = getStatusPresentation(file.status);
              const StatusIcon = status.icon;
              const canDownload = file.status === "READY";

              return (
                <article key={file.id} className="group rounded-[24px] border border-[#e8e8e6] bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,.035)] transition-colors hover:bg-slate-50/40 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f4f1ef] text-[#b9202b]"><StatusIcon className="size-5" aria-hidden="true" /></span>
                    <span className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                  </div>
                  <h3 className="mt-5 truncate text-lg font-semibold tracking-[-.025em] text-slate-950" title={file.fileName}>{file.fileName}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{status.description}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-4 text-xs">
                    <div className="min-w-0"><dt className="text-slate-400">Размер</dt><dd className="mt-1 font-semibold text-slate-700">{formatSize(file.sizeBytes)}</dd></div>
                    <div className="min-w-0"><dt className="text-slate-400">Добавлен</dt><dd className="mt-1 font-semibold text-slate-700">{formatDate(file.createdAt)}</dd></div>
                  </dl>
                  {canDownload ? (
                    <button
                      type="button"
                      onClick={() => download(file.id)}
                      disabled={Boolean(downloadingId)}
                      className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9202b]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {downloadingId === file.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
                      {downloadingId === file.id ? "Готовим ссылку…" : "Скачать"}
                    </button>
                  ) : (
                    <div className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-slate-50 px-4 text-xs font-semibold text-slate-500" role="status">
                      Скачивание станет доступно после проверки
                    </div>
                  )}
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
