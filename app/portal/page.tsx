import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, BriefcaseBusiness } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { getCaseStageLabel, getCaseStatusLabel, getPlanLabel } from "@/lib/platform/case-progress";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";

export const dynamic = "force-dynamic";

const ROLE_LABELS = {
  CLIENT: "Клиент",
  LAWYER: "Юрист",
  MANAGER: "Руководитель",
} as const;

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

  return (
    <PortalFrame sectionLabel="Личный кабинет" showStaffTasks={isStaff}>
      <section className="py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7B2330]">iБюро · сопровождение дела</p>
          <h1 className="mt-4 font-[var(--font-iburo-display)] text-5xl font-semibold leading-none text-slate-900 sm:text-6xl">
            Ваш личный кабинет
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500">
            Здесь собраны ваши дела, текущие этапы, документы, обучение и уведомления. Состав разделов зависит от вашей роли и доступных дел.
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

      <section aria-labelledby="cases-heading" className="pb-12">
        <div className="mb-5 flex items-center gap-3">
          <BriefcaseBusiness className="size-5 text-slate-500" aria-hidden="true" />
          <h2 id="cases-heading" className="text-lg font-bold text-slate-900">Ваши дела</h2>
        </div>

        {cases.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cases.map((clientCase) => (
              <article key={clientCase.id} className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs font-semibold tracking-[0.08em] text-slate-400">{clientCase.caseNumber}</p>
                    <h3 className="mt-3 text-2xl font-bold text-slate-900">Тариф «{getPlanLabel(clientCase.planCode)}»</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                    {getCaseStatusLabel(clientCase.status)}
                  </span>
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm">
                  <div>
                    <dt className="text-slate-400">Текущий этап</dt>
                    <dd className="mt-1 font-semibold text-slate-700">{getCaseStageLabel(clientCase.stageCode)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Доступ</dt>
                    <dd className="mt-1 font-semibold text-emerald-700">Открыт</dd>
                  </div>
                </dl>
                <Link
                  href={`/portal/cases/${clientCase.id}`}
                  className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#17202a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#263342]"
                >
                  Открыть дело
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
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
