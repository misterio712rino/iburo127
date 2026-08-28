import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { ProductionDocuments } from "@/components/platform/documents/ProductionDocuments";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { listCaseDocuments } from "@/server/documents/operations";

export const dynamic = "force-dynamic";

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
  const canClientEdit = actor.roles.includes("CLIENT") && clientCase.clientId === actor.userId;
  const canReview = actor.roles.includes("MANAGER") || (actor.roles.includes("LAWYER") && clientCase.assignedLawyerId === actor.userId);
  const isStaff = actor.roles.includes("LAWYER") || actor.roles.includes("MANAGER");

  return (
    <PortalFrame sectionLabel="Защищённые документы" accessLabel="Доступ подтверждён" showStaffTasks={isStaff}>
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
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Документы формируются из серверного состояния анкеты. Клиент создаёт и передаёт черновики на проверку, а назначенный юрист или руководитель подтверждает результат.</p>
            </div>
          </div>
        </section>

        <ProductionDocuments
          caseId={clientCase.id}
          canClientEdit={canClientEdit}
          canReview={canReview}
          initialDocuments={documents.map((document) => ({
            id: document.id,
            documentCode: document.documentCode,
            status: document.status,
            regeneratedAt: document.regeneratedAt?.toISOString() ?? null,
            sentForReviewAt: document.sentForReviewAt?.toISOString() ?? null,
            reviewedAt: document.reviewedAt?.toISOString() ?? null,
            version: document.version,
          }))}
        />
      </main>
    </PortalFrame>
  );
}
