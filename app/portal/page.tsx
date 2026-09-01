import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import {
  getCaseStageDisplayLabel,
  getCaseStatusLabel,
  getPlanDisplayLabel,
} from "@/lib/platform/case-progress";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCaseProgressSummaryForActor } from "@/server/case-progress/operations";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";
import type { ClientCaseRecord } from "@/server/domain/client-cases/contracts";

export const dynamic = "force-dynamic";

const ROLE_LABELS = {
  CLIENT: "Клиент",
  LAWYER: "Юрист",
  MANAGER: "Руководитель",
} as const;

const PLAN_PRIORITY: Readonly<Record<string, number>> = {
  INDIVIDUAL: 30,
  PRO: 20,
  LITE: 10,
};

const STATUS_PRIORITY: Readonly<Record<ClientCaseRecord["status"], number>> = {
  ACTIVE: 50,
  DRAFT: 40,
  PAUSED: 30,
  COMPLETED: 20,
  ARCHIVED: 10,
};

export function selectPrimaryClientCase(cases: readonly ClientCaseRecord[]) {
  return [...cases].sort((left, right) => {
    const statusDelta = STATUS_PRIORITY[right.status] - STATUS_PRIORITY[left.status];
    if (statusDelta !== 0) return statusDelta;
    const planDelta = (PLAN_PRIORITY[right.planCode] ?? 0) - (PLAN_PRIORITY[left.planCode] ?? 0);
    if (planDelta !== 0) return planDelta;
    return left.caseNumber.localeCompare(right.caseNumber, "ru");
  })[0];
}

export default async function PortalPage() {
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

  const cases = await clientCaseService.listCases(actor);
  const isStaff = actor.roles.includes("LAWYER") || actor.roles.includes("MANAGER");
  const clientOwnedCases = cases.filter(
    (clientCase) => resolveCasePortalAudience(actor, clientCase) === "CLIENT",
  );
  const isClientOnly = actor.roles.includes("CLIENT") && !isStaff;

  if (isClientOnly) {
    const primaryClientCase = selectPrimaryClientCase(clientOwnedCases);
    if (primaryClientCase) {
      redirect(`/portal/cases/${primaryClientCase.id}`);
    }
  }

  const clientProgressEntries = await Promise.all(
    clientOwnedCases.map(async (clientCase) => [
      clientCase.id,
      await getCaseProgressSummaryForActor(actor, clientCase, "CLIENT"),
    ] as const),
  );
  const clientProgressByCase = new Map(clientProgressEntries);
  const primaryClientCase = selectPrimaryClientCase(clientOwnedCases);
  const primaryNextAction = primaryClientCase
    ? clientProgressByCase.get(primaryClientCase.id)?.nextAction
    : undefined;

  return (
    <PortalFrame sectionLabel="Личный кабинет" showStaffTasks={isStaff} showProspectLeads={actor.roles.includes("MANAGER")}>
      <section className="py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7B2330]">iБюро · рабочий кабинет</p>
          <h1 className="mt-4 font-[var(--font-iburo-display)] text-5xl font-semibold leading-none text-slate-900 sm:text-6xl">
            {isStaff ? "Рабочее пространство" : "Ваш личный кабинет"}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500">
            {isStaff
              ? "Здесь собраны доступные вам дела. Клиентские тарифы отображаются сотрудникам только как атрибут конкретного дела."
              : "Когда активное дело будет создано, личный кабинет откроет его автоматически."}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {actor.roles.map((role) => (
            <span key={role} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
              {ROLE_LABELS[role]}
            </span>
          ))}
        </div>
      </section>

      {primaryClientCase && primaryNextAction ? (
        <section className="mb-8 rounded-[30px] border border-[#7B2330]/15 bg-[#7B2330]/[0.04] p-6 sm:p-7" aria-labelledby="portal-next-action-heading">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7B2330]">Сейчас важно</p>
              <p className="mt-2 font-mono text-xs font-semibold text-slate-400">{primaryClientCase.caseNumber}</p>
              <h2 id="portal-next-action-heading" className="mt-2 text-2xl font-bold text-slate-900">{primaryNextAction.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{primaryNextAction.description}</p>
            </div>
            <Link
              href={`/portal/cases/${primaryClientCase.id}/${primaryNextAction.segment}`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#17202a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#263342]"
            >
              Перейти к следующему шагу
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="cases-heading" className="pb-12">
        <div className="mb-5 flex items-center gap-3">
          <BriefcaseBusiness className="size-5 text-slate-500" aria-hidden="true" />
          <h2 id="cases-heading" className="text-lg font-bold text-slate-900">{isStaff ? "Доступные дела" : "Ваши дела"}</h2>
        </div>

        {cases.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cases.map((clientCase) => {
              const audience = resolveCasePortalAudience(actor, clientCase);
              const nextAction = clientProgressByCase.get(clientCase.id)?.nextAction;

              return (
                <article key={clientCase.id} className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
                      <h3 className="mt-3 text-2xl font-bold text-slate-900">Тариф «{getPlanDisplayLabel(clientCase.planCode, audience)}»</h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                      {getCaseStatusLabel(clientCase.status)}
                    </span>
                  </div>
                  <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm">
                    <div>
                      <dt className="text-slate-400">Текущий этап</dt>
                      <dd className="mt-1 font-semibold text-slate-700">{getCaseStageDisplayLabel(clientCase.stageCode, audience)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Доступ</dt>
                      <dd className="mt-1 font-semibold text-emerald-700">Открыт</dd>
                    </div>
                  </dl>

                  {nextAction ? (
                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Следующий шаг</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">{nextAction.title}</p>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap gap-2">
                    <Link
                      href={`/portal/cases/${clientCase.id}`}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#17202a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#263342]"
                    >
                      Открыть дело
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Link>
                    {nextAction ? (
                      <Link
                        href={`/portal/cases/${clientCase.id}/${nextAction.segment}`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        К шагу
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm leading-6 text-slate-500">
            В кабинете пока нет доступных дел. Когда дело будет создано или назначено вам, оно появится здесь.
          </div>
        )}
      </section>
    </PortalFrame>
  );
}
