import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { CasePortalFrame } from "@/components/portal/CasePortalFrame";
import { ClientCaseModuleIntro } from "@/components/portal/ClientCaseModuleIntro";
import { ProductionDocuments } from "@/components/platform/documents/ProductionDocuments";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCaseProgressSummaryForActor } from "@/server/case-progress/operations";
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

  const audience = resolveCasePortalAudience(actor, clientCase);
  const [documents, summary] = await Promise.all([
    listCaseDocuments(sessionProvider, caseId),
    getCaseProgressSummaryForActor(actor, clientCase, audience),
  ]);
  const canClientEdit = audience === "CLIENT";
  const canReview =
    audience === "STAFF" &&
    clientCase.clientId !== actor.userId &&
    (actor.roles.includes("MANAGER") ||
      (actor.roles.includes("LAWYER") && clientCase.assignedLawyerId === actor.userId));
  const isStaff = audience === "STAFF";
  const documentsView = (
    <ProductionDocuments
      caseId={clientCase.id}
      canClientEdit={canClientEdit}
      canReview={canReview}
      questionnaire={{
        completed: summary.questionnaire.completed,
        total: summary.questionnaire.total,
        percent: summary.questionnaire.percent,
      }}
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
  );

  return (
    <CasePortalFrame sessionProvider={sessionProvider} actor={actor} clientCase={clientCase} sectionLabel="Документы" showStaffTasks={isStaff}>
      <div className={isStaff ? "py-10 sm:py-14" : "py-1 sm:py-2"}>
        {isStaff ? (
          <>
            <Link href={`/portal/cases/${caseId}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Назад к делу
            </Link>
            <section className="mt-6 rounded-[32px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_55px_rgba(75,57,43,0.07)] sm:p-8">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f0eeea] text-[#b9202b] sm:size-12"><FileText className="size-5 sm:size-6" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
                  <h1 className="mt-2 break-words font-[var(--font-iburo-display)] text-3xl font-semibold leading-none text-slate-900 sm:text-5xl">Документы</h1>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Документы, которые клиент передал на проверку, показаны первыми. Подтверждение доступно только сотруднику с текущим доступом к этому делу.</p>
                </div>
              </div>
              {documentsView}
            </section>
          </>
        ) : (
          <>
            <ClientCaseModuleIntro
              caseId={clientCase.id}
              caseNumber={clientCase.caseNumber}
              title="Документы"
              description="Платформа готовит документы на основе актуальных данных вашей анкеты. Проверяйте черновики и передавайте готовые материалы специалисту."
              icon={FileText}
            />
            <div className="mt-6">{documentsView}</div>
          </>
        )}
      </div>
    </CasePortalFrame>
  );
}
