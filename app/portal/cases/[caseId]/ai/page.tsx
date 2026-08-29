import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { AiAssistant } from "@/components/platform/ai/AiAssistant";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";

export const dynamic = "force-dynamic";

export default async function PortalCaseAiPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const sessionProvider = createProductionSessionProvider();

  let actor;
  try {
    actor = await getCurrentPlatformActor(sessionProvider);
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) redirect("/auth/sign-in");
    throw error;
  }

  if (!actor.roles.includes("CLIENT")) notFound();

  const clientCase = await clientCaseService.getCase(actor, { caseId });
  if (!clientCase || clientCase.clientId !== actor.userId) notFound();

  return (
    <PortalFrame sectionLabel="Защищённый AI-помощник" accessLabel="Доступ подтверждён">
      <main className="py-10 sm:py-12">
        <Link href={`/portal/cases/${clientCase.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Назад к делу
        </Link>

        <section className="mt-8 rounded-[30px] border border-white/80 bg-white/80 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-7">
          <div className="mb-7 flex min-w-0 flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
              <h1 className="mt-3 flex min-w-0 items-center gap-2 break-words font-[var(--font-iburo-display)] text-3xl font-semibold text-slate-900 sm:gap-3 sm:text-5xl">
                <Sparkles className="size-6 shrink-0 text-[#7B2330] sm:size-7" aria-hidden="true" />
                AI-помощник
              </h1>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-600">{clientCase.planCode}</span>
          </div>

          <AiAssistant caseId={clientCase.id} withShell={false} />
        </section>
      </main>
    </PortalFrame>
  );
}
