import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ListChecks, ShieldCheck } from "lucide-react";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import { ProductionQuestionnaire } from "@/components/platform/questionnaire/ProductionQuestionnaire";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { getQuestionnaire } from "@/server/questionnaire/operations";

export const dynamic = "force-dynamic";

export default async function PortalQuestionnairePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
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
  const canEdit = actor.roles.includes("CLIENT") && clientCase.clientId === actor.userId;

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <IBuroBrand dot className="font-[var(--font-iburo-display)] text-4xl font-semibold tracking-tight" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Анкета дела</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Доступ подтверждён
          </span>
          <SignOutButton />
        </div>
      </header>

      <main className="py-10">
        <Link href={`/portal/cases/${clientCase.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          К делу {clientCase.caseNumber}
        </Link>

        <section className="mt-8 rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
              <ListChecks className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
              <h1 className="mt-2 font-[var(--font-iburo-display)] text-5xl font-semibold leading-none text-slate-900">Анкета</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">
                Ответы сохраняются через авторизованный серверный workflow с контролем версии. Изменение ответа автоматически снимает подтверждение соответствующего раздела и итоговой проверки.
              </p>
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
      </main>
    </div>
  );
}
