import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { ProductionPracticum } from "@/components/platform/practicum/ProductionPracticum";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { getPracticumProgress } from "@/server/practicum/operations";

export const dynamic = "force-dynamic";

export default async function PortalPracticumPage({ params }: { params: Promise<{ caseId: string }> }) {
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

  const progress = await getPracticumProgress(sessionProvider, caseId);
  const canEdit = actor.roles.includes("CLIENT") && clientCase.clientId === actor.userId;
  const isStaff = actor.roles.includes("LAWYER") || actor.roles.includes("MANAGER");

  return (
    <PortalFrame sectionLabel="Защищённый практикум" accessLabel="Доступ подтверждён" showStaffTasks={isStaff}>
      <main className="py-10 sm:py-14">
        <Link href={`/portal/cases/${caseId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Назад к делу
        </Link>

        <section className="mt-8 rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-700"><GraduationCap className="size-6" aria-hidden="true" /></span>
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
              <h1 className="mt-2 font-[var(--font-iburo-display)] text-5xl font-semibold leading-none text-slate-900">Практикум</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">Прогресс хранится в PostgreSQL и изменяется только через авторизованный серверный workflow. При параллельном изменении используется контроль версии.</p>
            </div>
          </div>

          <ProductionPracticum
            caseId={clientCase.id}
            canEdit={canEdit}
            initialState={progress ? {
              completedLessonIds: [...progress.completedLessonIds],
              version: progress.version,
              completedAt: progress.completedAt?.toISOString() ?? null,
            } : null}
          />
        </section>
      </main>
    </PortalFrame>
  );
}
