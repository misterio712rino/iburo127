import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, ListChecks, ShieldCheck } from "lucide-react";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import { SignOutButton } from "@/components/platform/auth/SignOutButton";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import { getQuestionnaire } from "@/server/questionnaire/operations";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  NOT_STARTED: "Не начата",
  IN_PROGRESS: "Заполняется",
  COMPLETED: "Завершена",
} as const;

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
  const answerCount = questionnaire ? Object.keys(questionnaire.answers).length : 0;
  const sectionCount = questionnaire?.completedSectionIds.length ?? 0;

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
                Это первый экран production-портала, который читает реальное состояние workflow через server-side service, а не через demo/localStorage adapter.
              </p>
            </div>
          </div>

          {questionnaire ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Статус" value={STATUS_LABELS[questionnaire.status]} />
              <Metric label="Ответов сохранено" value={String(answerCount)} />
              <Metric label="Разделов завершено" value={String(sectionCount)} />
              <Metric label="Версия" value={String(questionnaire.version)} />
            </div>
          ) : (
            <div className="mt-8 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 p-6">
              <p className="font-semibold text-slate-900">Анкета ещё не создана</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Запись `CaseQuestionnaire` для этого дела отсутствует. Этот read-only экран намеренно не создаёт данные автоматически.
              </p>
            </div>
          )}

          {questionnaire?.status === "COMPLETED" ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="size-5" aria-hidden="true" />
              Анкета завершена и зафиксирована в серверном состоянии.
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
