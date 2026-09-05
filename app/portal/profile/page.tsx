import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, KeyRound } from "lucide-react";

import { ProfileAvatarEditor, ProfileContactEditor, ProfileDisplayNameEditor } from "@/components/platform/account/ProfileAccountEditor";
import { IBuroClientShellV2 } from "@/components/portal/IBuroClientShellV2";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { getCaseStageDisplayLabel, getCaseStatusLabel, getPlanDisplayLabel } from "@/lib/platform/case-progress";
import { getClientCaseDisplayNumber } from "@/lib/platform/client-case-number";
import { formatProfileDisplayName } from "@/lib/platform/profile-display-name";
import type { PlanCode } from "@/lib/platform/types";
import { getCurrentAccountAvatarUrl } from "@/server/account/avatar";
import { getCurrentAccountProfile } from "@/server/account/operations";
import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { UNAUTHENTICATED } from "@/server/auth/runtime";
import { listAccessibleClientCases } from "@/server/client-cases/operations";
import { listNotifications } from "@/server/notifications/operations";

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

function getClientPlanLabel(planCode: PlanCode) {
  if (planCode === "INDIVIDUAL") return "Эксклюзив";
  return getPlanDisplayLabel(planCode, "CLIENT");
}

export default async function PortalProfilePage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const sessionProvider = createProductionSessionProvider();
  const requestedCaseId = (await searchParams).caseId?.trim();

  let profile;
  let cases;
  let avatarUrl: string | null;
  let notifications;
  try {
    [profile, cases, avatarUrl, notifications] = await Promise.all([
      getCurrentAccountProfile(sessionProvider),
      listAccessibleClientCases(sessionProvider),
      getCurrentAccountAvatarUrl(sessionProvider),
      listNotifications(sessionProvider, 100),
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
  const storedDisplayName = profile.displayName?.trim() || (isStaff ? "Пользователь iБюро" : "Клиент iБюро");
  const displayName = formatProfileDisplayName(storedDisplayName);
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const securityHref = selectedClientCase ? `/portal/security?caseId=${selectedClientCase.id}` : "/portal/security";

  const content = (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-7 py-1 sm:gap-9 sm:py-2">
      <header>
        <p className="text-sm font-semibold text-primary">Учётная запись</p>
        <h1 className="mt-2 break-words font-[var(--font-iburo-display)] text-3xl font-semibold tracking-[-.04em] text-foreground sm:text-5xl">Профиль</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Личные данные, доступные дела и настройки защищённого кабинета.</p>
      </header>

      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.18fr)_minmax(20rem,.82fr)] lg:gap-6">
        <article className="min-w-0 rounded-[30px] border border-border bg-card p-5 text-card-foreground shadow-[0_18px_55px_rgba(0,0,0,.05)] sm:p-7 lg:p-8">
          <div className="flex min-w-0 flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
            <ProfileAvatarEditor avatarUrl={avatarUrl} />
            <div className="min-w-0 w-full flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Личный кабинет</p>
              <ProfileDisplayNameEditor displayName={storedDisplayName} />
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:mx-0">Имя, фотографию и контактные данные можно менять прямо здесь.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start" aria-label="Роли учётной записи">
                {profile.roles.map((role) => (
                  <span key={role} className="inline-flex min-h-7 items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{ROLE_LABELS[role]}</span>
                ))}
              </div>
            </div>
          </div>

          <section className="mt-7 border-t border-border pt-6 text-left" aria-labelledby="profile-contact-heading">
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <h2 id="profile-contact-heading" className="text-lg font-bold text-foreground">Контактные данные</h2>
              <p className="text-sm text-muted-foreground">Для связи и уведомлений</p>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <ProfileContactEditor field="email" value={profile.email} />
              <ProfileContactEditor field="phone" value={profile.phone} />
            </dl>
          </section>

          <p className="mt-6 text-left text-xs leading-5 text-muted-foreground">Учётная запись создана {profile.createdAt.toLocaleDateString("ru-RU")}.</p>
        </article>

        <aside className="grid min-w-0 content-start gap-5 lg:gap-6" aria-label="Сводка учётной записи">
          <article className="min-w-0 rounded-[28px] border border-border bg-card p-5 text-card-foreground shadow-[0_14px_45px_rgba(0,0,0,.045)] sm:p-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted text-primary"><BriefcaseBusiness className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0"><h2 className="text-lg font-bold text-foreground">Мои дела</h2><p className="mt-0.5 text-sm text-muted-foreground">Только доступные вашей учётной записи.</p></div>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-2.5">
              <Metric label="Всего" value={cases.length} />
              <Metric label="Активных" value={activeCases} />
              <Metric label="Завершено" value={completedCases} />
            </dl>
            {cases.length ? (
              <div className="mt-5 space-y-3 border-t border-border pt-5">
                {cases.slice(0, 3).map((item) => {
                  const planLabel = getClientPlanLabel(requirePlanCode(item.planCode));
                  const stageLabel = getCaseStageDisplayLabel(item.stageCode, isClientOnly ? "CLIENT" : "STAFF");
                  const lawyerLabel = item.assignedLawyerId ? "Юрист назначен" : "Юрист ещё не назначен";

                  return (
                    <Link
                      key={item.id}
                      href={`/portal/cases/${item.id}`}
                      className="group block min-w-0 rounded-2xl border border-border bg-background/45 p-4 transition-colors hover:border-primary/20 hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold leading-5 text-foreground">{getClientCaseDisplayNumber(item.caseNumber)}</p>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">Тариф {planLabel}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{getCaseStatusLabel(item.status)}</span>
                      </div>

                      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                        <div className="min-w-0 rounded-xl bg-muted/55 px-3 py-2.5">
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Текущий этап</dt>
                          <dd className="mt-1 break-words font-semibold leading-4 text-foreground">{stageLabel}</dd>
                        </div>
                        <div className="min-w-0 rounded-xl bg-muted/55 px-3 py-2.5">
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Сопровождение</dt>
                          <dd className="mt-1 break-words font-semibold leading-4 text-foreground">{lawyerLabel}</dd>
                        </div>
                      </dl>

                      <span className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-xs font-bold text-primary">
                        Открыть дело
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </Link>
                  );
                })}
                {cases.length > 3 ? <p className="px-1 pt-1 text-xs text-muted-foreground">Показано 3 из {cases.length} доступных дел.</p> : null}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/35 px-4 py-5 text-center">
                <p className="text-sm font-semibold text-foreground">Доступных дел пока нет</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Когда дело будет создано, его статус и текущий этап появятся здесь.</p>
              </div>
            )}
          </article>

          <article className="min-w-0 rounded-[28px] border border-border bg-card p-5 text-card-foreground shadow-[0_14px_45px_rgba(0,0,0,.045)] sm:p-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted text-primary"><KeyRound className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0"><h2 className="text-lg font-bold text-foreground">Безопасность</h2><p className="mt-0.5 text-sm text-muted-foreground">Двухфакторная защита и резервные коды.</p></div>
            </div>
            <Link href={securityHref} className="mt-5 inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-border bg-muted/45 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2">Настройки безопасности<ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" /></Link>
          </article>
        </aside>
      </section>
    </div>
  );

  if (selectedClientCase) {
    const planCode = requirePlanCode(selectedClientCase.planCode);
    const caseOptions = cases.map((item) => ({
      id: item.id,
      displayNumber: getClientCaseDisplayNumber(item.caseNumber),
      planLabel: getClientPlanLabel(requirePlanCode(item.planCode)),
    }));

    return (
      <IBuroClientShellV2
        caseId={selectedClientCase.id}
        displayName={displayName}
        caseDisplayNumber={getClientCaseDisplayNumber(selectedClientCase.caseNumber)}
        planLabel={getClientPlanLabel(planCode)}
        unreadCount={unreadCount}
        cases={caseOptions}
      >
        {content}
      </IBuroClientShellV2>
    );
  }

  return <PortalFrame sectionLabel="Профиль" showStaffTasks={isStaff}>{content}</PortalFrame>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-muted p-3 text-center">
      <dd className="text-2xl font-bold text-foreground">{value}</dd>
      <dt className="mt-1 break-words text-[11px] font-semibold text-muted-foreground">{label}</dt>
    </div>
  );
}
