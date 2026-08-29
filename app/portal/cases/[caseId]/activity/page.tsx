import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, ArrowLeft } from "lucide-react";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import { buildCaseActivityView } from "@/server/activity/presentation";
import { listCaseActivity } from "@/server/activity/operations";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import { clientCaseService } from "@/server/client-cases/runtime";

export const dynamic = "force-dynamic";

export default async function PortalCaseActivityPage({ params }: { params: Promise<{ caseId: string }> }) {
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
  const records = await listCaseActivity(sessionProvider, caseId, 100);
  const audience = resolveCasePortalAudience(actor, clientCase);
  const isStaff = audience === "STAFF";
  const events = buildCaseActivityView(records, audience);

  return (
    <PortalFrame sectionLabel="История дела" accessLabel="Доступ подтверждён" showStaffTasks={isStaff}>
      <main className="py-10">
        <Link href={`/portal/cases/${caseId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Назад к делу
        </Link>

        <div className="mt-8 flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm"><Activity className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h1 className="break-words font-[var(--font-iburo-display)] text-4xl font-semibold text-slate-900">История действий</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isStaff
                ? "Служебный журнал действий по делу. Технические детали доступны только сотрудникам с подтверждённым доступом."
                : "Основные изменения и действия по вашему делу без содержимого документов, ответов анкеты и служебных данных."}
            </p>
          </div>
        </div>

        {events.length ? (
          <ol className="mt-8 space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-bold text-slate-900">{event.label}</p>
                    {event.technical ? (
                      <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{event.technical.type}</p>
                    ) : null}
                  </div>
                  <time className="shrink-0 text-xs text-slate-400" dateTime={event.createdAt.toISOString()}>{event.createdAt.toLocaleString("ru-RU")}</time>
                </div>
                {event.technical?.metadata && Object.keys(event.technical.metadata).length ? (
                  <dl className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {Object.entries(event.technical.metadata).map(([key, value]) => (
                      <div key={key} className="max-w-full rounded-xl bg-slate-50 px-3 py-2 text-xs">
                        <dt className="break-all text-slate-400">{key}</dt>
                        <dd className="mt-0.5 break-all font-semibold text-slate-700">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-8 rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-sm text-slate-500">История этого дела пока пуста.</div>
        )}
      </main>
    </PortalFrame>
  );
}
