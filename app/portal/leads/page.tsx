import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { ManagerLeadWorkspace } from "@/components/portal/ManagerLeadWorkspace";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { listPotentialClientLeadsForManager } from "@/server/prospect-leads/operations";
import { buildManagerLeadViews } from "@/server/prospect-leads/manager-lead-view";

export const dynamic = "force-dynamic";

export default async function ProspectLeadsPage() {
  const sessionProvider = createProductionSessionProvider();
  let actor;
  try {
    actor = await getCurrentPlatformActor(sessionProvider);
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) redirect("/auth/sign-in");
    throw error;
  }

  if (!actor.roles.includes("MANAGER")) notFound();

  const leads = await listPotentialClientLeadsForManager(sessionProvider);
  const leadViews = buildManagerLeadViews(leads);
  const summary = leads.reduce(
    (result, lead) => {
      result[lead.status] += 1;
      return result;
    },
    { NEW: 0, CONVERTED: 0, ARCHIVED: 0 },
  );

  return (
    <PortalFrame sectionLabel="Потенциальные клиенты" showStaffTasks showProspectLeads>
      <section className="py-8 sm:py-10">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <p className="text-[15px] font-semibold uppercase tracking-[0.18em] text-[#7B2330]">Вход без активного доступа</p>
            <h1 className="mt-3 font-[var(--font-iburo-display)] text-4xl font-semibold leading-none text-slate-900 sm:text-5xl">
              Потенциальные клиенты
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-500">
              Здесь сохраняются телефоны и email людей, которые попытались войти в приложение, но не были найдены среди активных пользователей iБюро. Повторные обращения объединяются в одну запись.
            </p>
          </div>

          <a
            href="/api/platform/leads/export"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[#17202a] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#263342] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8f1720]/15 xl:self-auto"
          >
            <Download className="size-5" aria-hidden="true" />
            Выгрузить CSV
          </a>
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Сводка потенциальных клиентов">
          <Metric label="Всего" value={leads.length} />
          <Metric label="Новые" value={summary.NEW} alert={summary.NEW > 0} />
          <Metric label="Конвертированы" value={summary.CONVERTED} />
          <Metric label="Архив" value={summary.ARCHIVED} />
        </dl>
      </section>

      <section className="pb-12 sm:pb-16" aria-label="Список потенциальных клиентов">
        <ManagerLeadWorkspace items={leadViews} />
      </section>
    </PortalFrame>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-4 shadow-sm sm:px-5">
      <dt className="text-[13px] font-semibold text-slate-400">{label}</dt>
      <dd className={`mt-1.5 text-2xl font-bold ${alert ? "text-[#7B2330]" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}
