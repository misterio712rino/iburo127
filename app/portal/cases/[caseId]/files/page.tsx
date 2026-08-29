import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileLock2 } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { ProductionFiles } from "@/components/platform/files/ProductionFiles";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { listStoredFiles } from "@/server/files/operations";

export const dynamic = "force-dynamic";

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
  const isStaff = actor.roles.includes("LAWYER") || actor.roles.includes("MANAGER");

  return (
    <PortalFrame sectionLabel="Приватные файлы" accessLabel="Доступ подтверждён" showStaffTasks={isStaff}>
      <main className="py-10 sm:py-14">
        <Link href={`/portal/cases/${caseId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Назад к делу
        </Link>

        <section className="mt-8 rounded-[32px] border border-white/80 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700 sm:size-12"><FileLock2 className="size-5 sm:size-6" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
              <h1 className="mt-2 break-words font-[var(--font-iburo-display)] text-4xl font-semibold leading-none text-slate-900 sm:text-5xl">Файлы дела</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Загрузка идёт напрямую в закрытое object storage по краткоживущей подписанной ссылке. До серверной HEAD-проверки файл остаётся невидимым как `PENDING_UPLOAD`.</p>
            </div>
          </div>
        </section>

        <ProductionFiles
          caseId={clientCase.id}
          initialFiles={files.map((file) => ({
            id: file.id,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes.toString(),
            readyAt: file.readyAt?.toISOString() ?? null,
            createdAt: file.createdAt.toISOString(),
          }))}
        />
      </main>
    </PortalFrame>
  );
}
