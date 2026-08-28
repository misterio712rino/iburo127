import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { listCaseDocuments } from "@/server/documents/operations";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  WAITING_DATA: "Ожидает данные",
  DRAFT: "Черновик",
  READY_FOR_REVIEW: "Готов к проверке",
  SENT_FOR_REVIEW: "Передан на проверку",
  REVIEWED: "Проверен",
} as const;

export default async function PortalDocumentsPage({ params }: { params: Promise<{ caseId: string }> }) {
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

  const documents = await listCaseDocuments(sessionProvider, caseId);

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <IBuroBrand dot className="font-[var(--font-iburo-display)] text-4xl font-semibold tracking-tight" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Защищённые документы</p>
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
            <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-700"><FileText className="size-6" aria-hidden="true" /></span>
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
              <h1 className="mt-2 font-[var(--font-iburo-display)] text-5xl font-semibold leading-none text-slate-900">Документы</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Список получен из PostgreSQL через case-scoped authorization. Содержимое документов и приватные object keys здесь не раскрываются.</p>
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="documents-heading">
          <h2 id="documents-heading" className="text-lg font-bold text-slate-900">Документы по делу</h2>
          {documents.length ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {documents.map((document) => (
                <article key={document.id} className="rounded-[28px] border border-slate-200 bg-white/80 p-6">
                  <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{document.documentCode}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-lg font-bold text-slate-900">{STATUS_LABELS[document.status]}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">v{document.version}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm leading-6 text-slate-500">Документы для этого дела пока не созданы.</div>
          )}
        </section>
      </main>
    </div>
  );
}
