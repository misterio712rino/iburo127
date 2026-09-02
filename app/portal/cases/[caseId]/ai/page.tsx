import { notFound, redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { CasePortalFrame } from "@/components/portal/CasePortalFrame";
import { ClientCaseModuleIntro } from "@/components/portal/ClientCaseModuleIntro";
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
        <ClientCaseModuleIntro
          caseId={clientCase.id}
          caseNumber={clientCase.caseNumber}
          title="AI-помощник"
          description="Задавайте вопросы по материалам своего дела. Помощник учитывает доступный контекст, но не заменяет финальное юридическое заключение специалиста."
          icon={Sparkles}
          action={
            <span className="inline-flex min-h-9 items-center rounded-full border border-border bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
              {getPlanDisplayLabel(clientCase.planCode, "CLIENT")}
            </span>
          }
        />

        <section className="mt-6 rounded-[28px] border border-border bg-card p-4 text-card-foreground shadow-[0_14px_40px_rgba(0,0,0,.045)] sm:p-7">
          <AiAssistant caseId={clientCase.id} withShell={false} />
        </section>
      </div>
    </CasePortalFrame>
  );
}
