import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { AiAssistant } from "@/components/platform/ai/AiAssistant";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";

export const dynamic = "force-dynamic";

export default async function PortalCaseAiPage({
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
    if (error instanceof Error && error.message === UNAUTHENTICATED) {
      redirect("/auth/sign-in");
    }
    throw error;
  }

  if (!actor.roles.includes("CLIENT")) notFound();

  const clientCase = await clientCaseService.getCase(actor, { caseId });
  if (!clientCase || clientCase.clientId !== actor.userId) notFound();

  return (
    <div className="platform-shell mx-auto min-h-screen w-full max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <IBuroBrand dot className="font-[var(--font-iburo-display)] text-4xl font-semibold tracking-tight" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Защищённый AI-помощник
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Доступ подтверждён
          </span>
          <SignOutButton />
        </div>
      </header>

      <main className="py-10 sm:py-12">
        <Link
          href={`/portal/cases/${clientCase.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Назад к делу
        </Link>

        <section className="mt-8 rounded-[30px] border border-white/80 bg-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-7">
          <div className="mb-7 flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">
                {clientCase.caseNumber}
              </p>
              <h1 className="mt-3 flex items-center gap-3 font-[var(--font-iburo-display)] text-4xl font-semibold text-slate-900 sm:text-5xl">
                <Sparkles className="size-7 text-[#7B2330]" aria-hidden="true" />
                AI-помощник
              </h1>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
              {clientCase.planCode}
            </span>
          </div>

          <AiAssistant caseId={clientCase.id} withShell={false} />
        </section>
      </main>
    </div>
  );
}
