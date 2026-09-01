import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CasePortalFrame } from "@/components/portal/CasePortalFrame";
import { AiAssistant } from "@/components/platform/ai/AiAssistant";
import { getPlanDisplayLabel } from "@/lib/platform/case-progress";
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
    <CasePortalFrame sessionProvider={sessionProvider} actor={actor} clientCase={clientCase} sectionLabel="AI-помощник">
      <div className="py-1 sm:py-2">
        <Link href={`/portal/cases/${clientCase.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#77746e] transition hover:text-[#25282d]">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Назад к делу
        </Link>

        <section className="mt-6 rounded-[30px] border border-white/80 bg-white/75 p-4 shadow-[0_18px_55px_rgba(75,57,43,0.07)] sm:p-7">
          <div className="mb-7 flex min-w-0 flex-col gap-4 border-b border-black/[0.055] pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-[#9a9791]">{clientCase.caseNumber}</p>
              <h1 className="mt-3 flex min-w-0 items-center gap-2 break-words font-[var(--font-iburo-display)] text-3xl font-semibold text-[#272a30] sm:gap-3 sm:text-5xl">
                <Sparkles className="size-6 shrink-0 text-[#b9202b] sm:size-7" aria-hidden="true" />
                AI-помощник
              </h1>
            </div>
            <span className="w-fit rounded-full border border-black/[0.05] bg-[#f1eee9] px-4 py-2 text-xs font-bold text-[#66635e]">{getPlanDisplayLabel(clientCase.planCode, "CLIENT")}</span>
          </div>

          <AiAssistant caseId={clientCase.id} withShell={false} />
        </section>
      </div>
    </CasePortalFrame>
  );
}
