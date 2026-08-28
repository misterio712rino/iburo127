import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileLock2, ShieldCheck } from "lucide-react";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { listStoredFiles } from "@/server/files/operations";

export const dynamic = "force-dynamic";

function formatSize(size: bigint) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export default async function PortalFilesPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const sessionProvider = createProductionSessionProvider();

  let actor;
  try {
    actor = await getCurrentPlatformActor(sessionProvider);
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) redirect("/auth/sign-in");
    throw error;
  }

  const clientCase = await clientCaseService.getCase(actor, { caseId });
  if (!clientCase) notFound();

  const files = await listStoredFiles(sessionProvider, caseId);

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <IBuroBrand dot className="font-[var(--font-iburo-display)] text-4xl font-semibold tracking-tight" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Приватные файлы</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Доступ подтверждён
          </span>
          <SignOutButton />
        </div>
      </header>

      <main className="py-10 sm:py-14">
        <Link href={`/portal/cases/${caseId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Назад к делу
        </Link>

        <section className="mt-8 rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-700"><FileLock2 className="size-6" aria-hidden="true" /></span>
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
              <h1 className="mt-2 font-[var(--font-iburo-display)] text-5xl font-semibold leading-none text-slate-900">Файлы дела</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Показываются только READY-файлы, разрешённые сервером. Storage provider, object key и внутренние пути в интерфейс не выводятся.</p>
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="files-heading">
          <h2 id="files-heading" className="text-lg font-bold text-slate-900">Доступные файлы</h2>
          {files.length ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {files.map((file) => (
                <article key={file.id} className="rounded-[28px] border border-slate-200 bg-white/80 p-6">
                  <p className="truncate text-lg font-bold text-slate-900">{file.fileName}</p>
                  <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                    <div><dt className="text-slate-400">Тип</dt><dd className="mt-1 break-all font-semibold text-slate-700">{file.mimeType}</dd></div>
                    <div><dt className="text-slate-400">Размер</dt><dd className="mt-1 font-semibold text-slate-700">{formatSize(file.sizeBytes)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm leading-6 text-slate-500">Готовых файлов по этому делу пока нет.</div>
          )}
        </section>
      </main>
    </div>
  );
}
