import { notFound, redirect } from "next/navigation";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { listPotentialClientLeadsForManager } from "@/server/prospect-leads/operations";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
});

const STATUS_LABELS = {
  NEW: "Новый",
  CONVERTED: "Конвертирован",
  ARCHIVED: "Архив",
} as const;

const STATUS_STYLES = {
  NEW: "bg-[#7B2330]/10 text-[#7B2330]",
  CONVERTED: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
} as const;

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
  const summary = leads.reduce(
    (result, lead) => {
      result[lead.status] += 1;
      return result;
    },
    { NEW: 0, CONVERTED: 0, ARCHIVED: 0 },
  );

  return (
    <PortalFrame sectionLabel="Потенциальные клиенты" showStaffTasks showProspectLeads>
      <section className="py-12 sm:py-16">
        <div className="max-w-4xl">
          <p className="text-[15px] font-semibold uppercase tracking-[0.18em] text-[#7B2330]">Вход без активного доступа</p>
          <h1 className="mt-4 font-[var(--font-iburo-display)] text-5xl font-semibold leading-none text-slate-900 sm:text-6xl">
            Потенциальные клиенты
          </h1>
          <p className="mt-6 text-[17px] leading-8 text-slate-500">
            Здесь сохраняются телефоны и email людей, которые попытались войти в приложение, но не были найдены среди активных пользователей iБюро. Повторные обращения объединяются в одну запись.
          </p>
        </div>

        <dl className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Сводка потенциальных клиентов">
          <Metric label="Всего" value={leads.length} />
          <Metric label="Новые" value={summary.NEW} alert={summary.NEW > 0} />
          <Metric label="Конвертированы" value={summary.CONVERTED} />
          <Metric label="Архив" value={summary.ARCHIVED} />
        </dl>
      </section>

      <section className="pb-16" aria-label="Список потенциальных клиентов">
        {leads.length ? (
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-[15px]">
                <thead className="bg-slate-50 text-[13px] uppercase tracking-[0.09em] text-slate-400">
                  <tr>
                    <th className="px-6 py-5 font-bold">Контакт</th>
                    <th className="px-6 py-5 font-bold">Статус</th>
                    <th className="px-6 py-5 font-bold">Тип</th>
                    <th className="px-6 py-5 font-bold">Попыток</th>
                    <th className="px-6 py-5 font-bold">Первое обращение</th>
                    <th className="px-6 py-5 font-bold">Последнее обращение</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="text-slate-700">
                      <td className="px-6 py-5 font-semibold text-slate-900">{lead.email ?? lead.phone ?? "—"}</td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-[13px] font-bold ${STATUS_STYLES[lead.status]}`}>
                          {STATUS_LABELS[lead.status]}
                        </span>
                      </td>
                      <td className="px-6 py-5">{lead.contactType === "EMAIL" ? "Email" : "Телефон"}</td>
                      <td className="px-6 py-5 tabular-nums">{lead.attemptCount}</td>
                      <td className="px-6 py-5 whitespace-nowrap">{dateTime.format(lead.firstSeenAt)}</td>
                      <td className="px-6 py-5 whitespace-nowrap">{dateTime.format(lead.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-9 text-base leading-7 text-slate-500">
            Потенциальных клиентов из формы входа пока нет.
          </div>
        )}
      </section>
    </PortalFrame>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 px-5 py-5 shadow-sm">
      <dt className="text-[13px] font-semibold text-slate-400">{label}</dt>
      <dd className={`mt-2 text-[28px] font-bold ${alert ? "text-[#7B2330]" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}
