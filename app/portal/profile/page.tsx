import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, KeyRound, Mail, Phone } from "lucide-react";
import {
  ProfileAvatarEditor,
  ProfileDisplayNameEditor,
} from "@/components/platform/account/ProfileAccountEditor";
import { ClientCaseFrame, type ClientCaseOption } from "@/components/portal/ClientCaseFrame";
import { ClientPlanVisualStyles } from "@/components/portal/ClientPlanVisualStyles";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { getCaseStatusLabel, getPlanDisplayLabel } from "@/lib/platform/case-progress";
import type { PlanCode } from "@/lib/platform/types";
import { getCurrentAccountAvatarUrl } from "@/server/account/avatar";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
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
  let avatarUrl: string | null;
  try {
    [profile, cases, avatarUrl] = await Promise.all([
      getCurrentAccountProfile(sessionProvider),
      listAccessibleClientCases(sessionProvider),
      getCurrentAccountAvatarUrl(),
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
  const displayName = profile.displayName?.trim() || "Пользователь iБюро";

  const content = (
    <div className={`client-account-surface ${selectedClientCase ? "py-1 sm:py-2" : "py-12 sm:py-16"}`}>
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900 lg:gap-2.5 lg:text-base">
        <ArrowLeft className="size-4 lg:size-[18px]" aria-hidden="true" />
        В личный кабинет
      </Link>

      <section className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <article className="min-w-0 rounded-[32px] border border-white/80 bg-white/85 p-6 shadow-[0_18px_55px_rgba(75,57,43,0.07)] sm:p-7 lg:p-9">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
            <ProfileAvatarEditor avatarUrl={avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 lg:text-[13px]">Учётная запись</p>
              <h1 className="mt-2 break-words font-[var(--font-iburo-display)] text-4xl font-semibold text-slate-900 sm:text-5xl lg:text-6xl">
                {displayName}
              </h1>
              <ProfileDisplayNameEditor displayName={displayName} />
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.roles.map((role) => (
                  <span key={role} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 lg:px-3.5 lg:py-2 lg:text-[13px]">
                    {ROLE_LABELS[role]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <dl className="mt-8 grid gap-4 border-t border-slate-100 pt-6 lg:mt-9 lg:pt-7 sm:grid-cols-2">
            <ProfileField icon={Mail} label="Email" value={profile.email || "Не указан"} />
            <ProfileField icon={Phone} label="Телефон" value={profile.phone || "Не указан"} />
          </dl>

          <p className="mt-7 text-xs leading-5 text-slate-400 lg:text-sm lg:leading-6">
            Учётная запись создана {profile.createdAt.toLocaleDateString("ru-RU")}. Имя и фотографию можно менять прямо в профиле; контактные данные отображаются из учётной записи iБюро.
          </p>
        </article>

        <div className="grid min-w-0 gap-5 lg:gap-6">
          <article className="min-w-0 rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_14px_45px_rgba(75,57,43,0.06)] lg:p-7">
            <div className="flex min-w-0 items-center gap-3 lg:gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f0eeea] text-[#b9202b] lg:size-12"><BriefcaseBusiness className="size-5 lg:size-[22px]" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold text-slate-900 lg:text-xl">Дела</h2>
                <p className="mt-0.5 break-words text-sm text-slate-500 lg:text-base">Только дела, доступные вашей учётной записи.</p>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-3 gap-3 lg:mt-7 lg:gap-3.5">
              <Metric label="Всего" value={cases.length} />
              <Metric label="Активных" value={activeCases} />
              <Metric label="Завершено" value={completedCases} />
            </dl>
            {cases.length ? (
              <div className="mt-6 space-y-2.5 border-t border-slate-100 pt-6">
                {cases.slice(0, 3).map((item) => (
                  <Link key={item.id} href={`/portal/cases/${item.id}`} className="flex min-h-[52px] min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3 text-sm transition hover:border-slate-200 hover:bg-slate-50 lg:text-base">
                    <span className="min-w-0 break-all font-mono text-xs font-semibold text-slate-600 lg:text-[13px]">{item.caseNumber}</span>
                    <span className="shrink-0 text-xs font-semibold text-slate-400 lg:text-[13px]">{getCaseStatusLabel(item.status)}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </article>

          <article className="min-w-0 rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_14px_45px_rgba(75,57,43,0.06)] lg:p-7">
            <div className="flex min-w-0 items-center gap-3 lg:gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f0eeea] text-[#b9202b] lg:size-12"><KeyRound className="size-5 lg:size-[22px]" aria-hidden="true" /></span>
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold text-slate-900 lg:text-xl">Безопасность аккаунта</h2>
                <p className="mt-0.5 break-words text-sm text-slate-500 lg:text-base">Пароль, двухфакторная защита и резервные коды.</p>
              </div>
            </div>
            <Link href={securityHref} className="mt-5 inline-flex min-h-11 max-w-full items-center break-words rounded-xl bg-[#17202a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#263342] lg:px-5 lg:py-3 lg:text-base">
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
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 lg:p-5">
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 lg:text-[13px]"><Icon className="size-4 shrink-0 lg:size-[18px]" aria-hidden="true" />{label}</dt>
      <dd className="mt-2 break-all text-sm font-semibold text-slate-800 lg:mt-2.5 lg:text-base">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-3 text-center lg:p-4">
      <dd className="text-2xl font-bold text-slate-900 lg:text-3xl">{value}</dd>
      <dt className="mt-1 break-words text-[11px] font-semibold text-slate-400 lg:text-xs">{label}</dt>
    </div>
  );
}
