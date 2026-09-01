import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ListChecks } from "lucide-react";
import { CasePortalFrame } from "@/components/portal/CasePortalFrame";
import { ProductionQuestionnaire } from "@/components/platform/questionnaire/ProductionQuestionnaire";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { getQuestionnaire } from "@/server/questionnaire/operations";

export const dynamic = "force-dynamic";

export default async function PortalQuestionnairePage({ params }: { params: Promise<{ caseId: string }> }) {
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

  const questionnaire = await getQuestionnaire(sessionProvider, clientCase.id);
  const audience = resolveCasePortalAudience(actor, clientCase);
  const canEdit = audience === "CLIENT";
  const isStaff = audience === "STAFF";

  return (
    <CasePortalFrame sessionProvider={sessionProvider} actor={actor} clientCase={clientCase} sectionLabel="Анкета дела" showStaffTasks={isStaff}>
      <div className={isStaff ? "py-10" : "py-1 sm:py-2"}>
        <Link href={`/portal/cases/${clientCase.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          К делу {clientCase.caseNumber}
        </Link>

        <section className="mt-6 rounded-[32px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_55px_rgba(75,57,43,0.07)] sm:p-8">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f0eeea] text-[#b9202b] sm:size-12"><ListChecks className="size-5 sm:size-6" aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
              <h1 className="mt-2 break-words font-[var(--font-iburo-display)] text-3xl font-semibold leading-none text-slate-900 sm:text-5xl">Анкета</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Заполняйте сведения по разделам и сохраняйте ответы по мере готовности. Если изменить ответ, соответствующий раздел потребуется подтвердить повторно.</p>
            </div>
          </div>

          <ProductionQuestionnaire
            caseId={clientCase.id}
            canEdit={canEdit}
            initialState={questionnaire ? {
              status: questionnaire.status,
              answers: questionnaire.answers,
              completedSectionIds: [...questionnaire.completedSectionIds],
              version: questionnaire.version,
              completedAt: questionnaire.completedAt?.toISOString() ?? null,
            } : null}
          />
        </section>
      </div>
    </CasePortalFrame>
  );
}
