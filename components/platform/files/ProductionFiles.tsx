"use client";

import { useRef, useState } from "react";
import { Download, Loader2, ShieldCheck, UploadCloud } from "lucide-react";

type StoredFileView = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
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

export function ProductionFiles({
  caseId,
  canUpload,
  initialFiles,
}: {
  caseId: string;
  canUpload: boolean;
  initialFiles: StoredFileView[];
}) {
  const [files, setFiles] = useState(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refreshFiles() {
    const response = await fetch(`/api/platform/cases/${caseId}/files`, {
      method: "GET",
      cache: "no-store",
    });
    const result = (await response.json()) as ApiResult<StoredFileView[]>;
    if (!result.ok) throw new Error(result.error.code);
    setFiles(result.data);
  }

  async function upload(file: File) {
    if (!canUpload || uploading) return;
    setError(null);

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      setError("Размер файла должен быть от 1 байта до 50 МБ.");
      return;
    }

    setUploading(true);
    try {
      const prepareResponse = await fetch(`/api/platform/cases/${caseId}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
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

      const completeResponse = await fetch(
        `/api/platform/files/${prepared.data.fileId}/complete`,
        {
          method: "POST",
          headers: { Accept: "application/json" },
        },
      );
      const completed = (await completeResponse.json()) as ApiResult<StoredFileView>;
      if (!completed.ok) {
        if (completeResponse.status === 409) {
          setError("Файл загружен, но проверка ещё не завершена. Повторите попытку через несколько секунд.");
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
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
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
    <div className="mt-8 space-y-6">
      {canUpload ? (
        <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-slate-900">Добавить файл в дело</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                PDF, JPG, PNG, WEBP, DOC или DOCX до 50 МБ. После загрузки файл проходит проверку безопасности и затем появляется в списке.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#17202a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#263342] has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50">
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
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5 text-sm leading-6 text-emerald-900">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">Режим просмотра сотрудника</p>
            <p className="mt-1 text-emerald-800">
              Здесь доступны только файлы, которые завершили проверку безопасности. Загрузка новых файлов выполняется клиентом из его части дела.
            </p>
          </div>
        </div>
      )}

      {error ? <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section aria-labelledby="ready-files-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="ready-files-heading" className="text-lg font-bold text-slate-900">Доступные файлы</h2>
          <span className="text-xs font-semibold text-slate-400">{files.length} шт.</span>
        </div>

        {files.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {files.map((file) => (
              <article key={file.id} className="rounded-[28px] border border-slate-200 bg-white/80 p-6">
                <p className="truncate text-lg font-bold text-slate-900">{file.fileName}</p>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-400">Тип</dt>
                    <dd className="mt-1 break-all font-semibold text-slate-700">{file.mimeType}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Размер</dt>
                    <dd className="mt-1 font-semibold text-slate-700">{formatSize(file.sizeBytes)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => download(file.id)}
                  disabled={Boolean(downloadingId)}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {downloadingId === file.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
                  {downloadingId === file.id ? "Готовим ссылку…" : "Скачать"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm leading-6 text-slate-500">
            Готовых файлов по этому делу пока нет.
          </div>
        )}
      </section>
    </div>
  );
}
