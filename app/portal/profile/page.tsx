import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, KeyRound, Mail, Phone, UserRound } from "lucide-react";
import { ClientCaseFrame, type ClientCaseOption } from "@/components/portal/ClientCaseFrame";
import { ClientPlanVisualStyles } from "@/components/portal/ClientPlanVisualStyles";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { getCaseStatusLabel, getPlanDisplayLabel } from "@/lib/platform/case-progress";
import type { PlanCode } from "@/lib/platform/types";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { listAccessibleClientCases } from "@/server/client-cases/operations";

export const dynamic = "force-dynamic";

const ROLE_LABELS = {
  CLIENT: "Клиент",
  LAWYER: "Юрист",
  MANAGER: "Руководитель",
} as const;

function requirePlanCode(value: string): PlanCode {
  if (value === "LITE" || value === "PRO" || value === "INDIVIDUAL") return value;
  throw new Error("UNSUPPORTED_CLIENT_PLAN");
}

export default async function PortalProfilePage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const sessionProvider = createProductionSessionProvider();
  const requestedCaseId = (await searchParams).caseId?.trim();

  let profile;
  let cases;
  try {
    [profile, cases] = await Promise.all([
      getCurrentAccountProfile(sessionProvider),
      listAccessibleClientCases(sessionProvider),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === UNAUTHENTICATED) redirect("/auth/sign-in");
    throw error;
  }

  const isStaff = profile.roles.includes("LAWYER") || profile.roles.includes("MANAGER");
  const isClientOnly = profile.roles.includes("CLIENT") && !isStaff;
  const selectedClientCase = isClientOnly
    ? cases.find((item) => item.id === requestedCaseId) ?? cases.find((item) => item.status === "ACTIVE") ?? cases[0]
    : undefined;
  const activeCases = cases.filter((item) => item.status === "ACTIVE").length;
  const completedCases = cases.filter((item) => item.status === "COMPLETED").length;
  const backHref = selectedClientCase ? `/portal/cases/${selectedClientCase.id}` : "/portal";
  const securityHref = selectedClientCase ? `/portal/security?caseId=${selectedClientCase.id}` : "/portal/security";

  const content = (
    <div className={`client-account-surface ${selectedClientCase ? "py-1 sm:py-2" : "py-12 sm:py-16"}`}>
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-2.5 text-base font-semibold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="size-[18px]" aria-hidden="true" />
        В личный кабинет
      </Link>

      <section className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <article className="min-w-0 rounded-[32px] border border-white/80 bg-white/85 p-7 shadow-[0_18px_55px_rgba(75,57,43,0.07)] sm:p-9">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-5">
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#f0eeea] text-[#b9202b]">
                <UserRound className="size-8" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-400">Учётная запись</p>
                <h1 className="mt-2 break-words font-[var(--font-iburo-display)] text-5xl font-semibold text-slate-900 sm:text-6xl">
                  {profile.displayName?.trim() || "Пользователь iБюро"}
                </h1>
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.roles.map((role) => (
                    <span key={role} className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-[13px] font-semibold text-slate-600">
                      {ROLE_LABELS[role]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <dl className="mt-9 grid gap-4 border-t border-slate-100 pt-7 sm:grid-cols-2">
            <ProfileField icon={Mail} label="Email" value={profile.email || "Не указан"} />
            <ProfileField icon={Phone} label="Телефон" value={profile.phone || "Не указан"} />
          </dl>

          <p className="mt-7 text-sm leading-6 text-slate-400">
            Учётная запись создана {profile.createdAt.toLocaleDateString("ru-RU")}. Контактные данные отображаются из вашей учётной записи iБюро.
          </p>
        </article>

        <div className="grid min-w-0 gap-6">
          <article className="min-w-0 rounded-[28px] border border-white/80 bg-white/85 p-7 shadow-[0_14px_45px_rgba(75,57,43,0.06)]">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f0eeea] text-[#b9202b]"><BriefcaseBusiness className="size-[22px]" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold text-slate-900">Дела</h2>
                <p className="mt-0.5 break-words text-base text-slate-500">Только дела, доступные вашей учётной записи.</p>
              </div>
            </div>
            <dl className="mt-7 grid grid-cols-3 gap-3.5">
              <Metric label="Всего" value={cases.length} />
              <Metric label="Активных" value={activeCases} />
              <Metric label="Завершено" value={completedCases} />
            </dl>
            {cases.length ? (
              <div className="mt-6 space-y-2.5 border-t border-slate-100 pt-6">
                {cases.slice(0, 3).map((item) => (
                  <Link key={item.id} href={`/portal/cases/${item.id}`} className="flex min-h-[52px] min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3 text-base transition hover:border-slate-200 hover:bg-slate-50">
                    <span className="min-w-0 break-all font-mono text-[13px] font-semibold text-slate-600">{item.caseNumber}</span>
                    <span className="shrink-0 text-[13px] font-semibold text-slate-400">{getCaseStatusLabel(item.status)}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </article>

          <article className="min-w-0 rounded-[28px] border border-white/80 bg-white/85 p-7 shadow-[0_14px_45px_rgba(75,57,43,0.06)]">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f0eeea] text-[#b9202b]"><KeyRound className="size-[22px]" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold text-slate-900">Безопасность аккаунта</h2>
                <p className="mt-0.5 break-words text-base text-slate-500">Пароль, двухфакторная защита и резервные коды.</p>
              </div>
            </div>
            <Link href={securityHref} className="mt-6 inline-flex min-h-[48px] max-w-full items-center break-words rounded-xl bg-[#17202a] px-5 py-3 text-base font-bold text-white transition hover:bg-[#263342]">
              Открыть настройки безопасности
            </Link>
          </article>
        </div>
      </section>
    </div>
  );

  if (selectedClientCase) {
    const caseOptions: ClientCaseOption[] = cases.map((item) => ({
      id: item.id,
      caseNumber: item.caseNumber,
      planLabel: getPlanDisplayLabel(item.planCode, "CLIENT"),
    }));
    const planCode = requirePlanCode(selectedClientCase.planCode);
    return (
      <>
        <ClientPlanVisualStyles planCode={planCode} />
        <ClientCaseFrame
          caseId={selectedClientCase.id}
          caseNumber={selectedClientCase.caseNumber}
          displayName={profile.displayName?.trim() || "Клиент iБюро"}
          planLabel={getPlanDisplayLabel(selectedClientCase.planCode, "CLIENT")}
          cases={caseOptions}
        >
          {content}
        </ClientCaseFrame>
      </>
    );
  }

  return <PortalFrame sectionLabel="Профиль" showStaffTasks={isStaff}>{content}</PortalFrame>;
}

function ProfileField({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
      <dt className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-400"><Icon className="size-[18px] shrink-0" aria-hidden="true" />{label}</dt>
      <dd className="mt-2.5 break-all text-base font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-4 text-center">
      <dd className="text-3xl font-bold text-slate-900">{value}</dd>
      <dt className="mt-1 break-words text-xs font-semibold text-slate-400">{label}</dt>
    </div>
  );
}
