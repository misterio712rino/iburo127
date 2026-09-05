"use client";

import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  MonitorDot,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useDemoIdentity } from "@/components/platform/DemoIdentityProvider";
import { IBuroBrand } from "@/components/platform/IBuroBrand";
import {
  PlanBadge,
  ProfileAvatar,
} from "@/components/platform/PlatformPrimitives";
import { DEMO_IDENTITIES } from "@/lib/platform/demo";
import { getPlatformTheme, PLAN_LABEL } from "@/lib/platform/themes";
import type { DemoIdentity, PlatformTheme } from "@/lib/platform/types";

const THEME_META: Record<
  PlatformTheme,
  { label: string; description: string; icon: typeof Sparkles }
> = {
  light: {
    label: "Светлый кабинет",
    description: "Простой путь к самостоятельному решению",
    icon: MonitorDot,
  },
  pro: {
    label: "PRO-среда",
    description: "Расширенный контроль каждого этапа",
    icon: ShieldCheck,
  },
  premium: {
    label: "Персональный формат",
    description: "Индивидуальное сопровождение дела",
    icon: Sparkles,
  },
  staff: {
    label: "Рабочая среда",
    description: "Единый обзор клиентов и дел",
    icon: BriefcaseBusiness,
  },
};

function ProfilePreviewCard({
  identity,
  onSelect,
}: {
  identity: DemoIdentity;
  onSelect: () => void;
}) {
  const theme = getPlatformTheme(identity);
  const meta = THEME_META[theme];
  const PreviewIcon = meta.icon;
  const [firstName, ...lastNameParts] = identity.displayName.trim().split(/\s+/);
  const lastName = lastNameParts.join(" ");
  const individual = identity.plan === "INDIVIDUAL";
  const roleLabel = identity.role === "MANAGER" ? "Руководитель" : identity.role === "LAWYER" ? "Сотрудник" : "Клиент";
  const previewLabel = identity.role === "MANAGER" ? "Операционная сводка" : identity.role === "LAWYER" ? "Активные дела" : "Прогресс дела";
  const identityLabel = identity.role === "MANAGER" ? "Руководитель практики" : identity.role === "LAWYER" ? "Юрист · Кабинет сотрудника" : `Тариф ${PLAN_LABEL[identity.plan!]}`;

  return (
    <motion.button
      type="button"
      data-preview-theme={theme}
      onClick={onSelect}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="profile-preview group flex min-h-[19rem] w-full flex-col overflow-hidden rounded-[2rem] border p-5 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7B2330]/25 max-[374px]:[&_.plan-badge]:px-2 max-[374px]:[&_.plan-badge]:text-[9px] max-[374px]:[&_.plan-badge]:tracking-[0.06em] sm:min-h-[21rem] sm:p-8"
    >
      <span className="profile-preview__accent" aria-hidden="true" />

      <span className={`grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-3 lg:flex lg:items-center ${individual ? "lg:gap-2" : "lg:gap-4"}`}>
        <ProfileAvatar initials={identity.initials} className="size-12" />
        <span className={`min-w-0 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-55 lg:pt-0 lg:whitespace-nowrap ${individual ? "lg:min-w-[4rem] lg:flex-none" : "lg:flex-1"}`}>
          {roleLabel}
        </span>
        {identity.plan ? (
          <span className={`${individual ? "profile-preview__plan--individual" : ""} shrink-0 whitespace-nowrap`}>
            <PlanBadge plan={identity.plan} />
          </span>
        ) : (
          <span className="profile-preview__staff-mark grid size-10 shrink-0 place-items-center rounded-2xl">
            <BriefcaseBusiness aria-hidden="true" />
          </span>
        )}
      </span>

      <span className="profile-preview__window mt-6 block w-full rounded-[1.25rem] border p-4 sm:mt-8">
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold">
            <PreviewIcon className="size-4" aria-hidden="true" />
            {previewLabel}
          </span>
          <span className="profile-preview__status size-2 rounded-full" />
        </span>
        <span className="mt-5 flex items-end gap-2" aria-hidden="true">
          <span className="profile-preview__bar h-1.5 w-2/3 rounded-full" />
          <span className="profile-preview__bar h-1.5 w-1/5 rounded-full opacity-40" />
        </span>
        <span className="mt-4 flex items-center gap-2 text-[11px] opacity-65">
          <Check className="size-3.5" aria-hidden="true" />
          {meta.description}
        </span>
      </span>

      <span className="mt-auto flex h-36 w-full items-end justify-between gap-4 pt-6 sm:gap-5 sm:pt-8">
        <span className="min-w-0 self-stretch">
          <span className="block min-h-14 text-2xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-[1.7rem]">
            <span className="block">{firstName}</span>
            <span className="block">{lastName}</span>
          </span>
          <span className="mt-2 block min-h-5 text-sm opacity-65">
            {identityLabel}
          </span>
          <span className="mt-3 block min-h-4 break-words font-mono text-[11px] font-medium tracking-[0.04em] opacity-55">
            {identity.caseNumber ? `Дело ${identity.caseNumber}` : null}
          </span>
        </span>
        <span className="profile-preview__action grid size-12 shrink-0 place-items-center rounded-full border transition-transform duration-200 group-hover:translate-x-1">
          <ArrowUpRight aria-hidden="true" />
          <span className="sr-only">Открыть кабинет</span>
        </span>
      </span>
    </motion.button>
  );
}

export default function PlatformPage() {
  const router = useRouter();
  const { selectIdentity } = useDemoIdentity();

  return (
    <main className="demo-entry relative min-h-screen overflow-hidden bg-[#F7F5F2] px-5 py-5 text-[#1D1D1F] sm:px-8 sm:py-7 lg:px-12">
      <div className="demo-entry__glow demo-entry__glow--top" aria-hidden="true" />
      <div className="demo-entry__glow demo-entry__glow--bottom" aria-hidden="true" />

      <div className="relative mx-auto max-w-[90rem]">
        <header className="flex flex-col items-center gap-4 border-b border-[#DED5CE]/80 pb-6 text-center sm:flex-row sm:justify-between sm:gap-5 sm:pb-7 sm:text-left">
          <div className="flex flex-col items-center leading-none sm:items-start">
            <IBuroBrand dot className="text-[34px] font-bold tracking-[-0.055em] text-[#1D1D1F] sm:text-[40px]" />
            <span className="mt-2 text-[9px] font-semibold uppercase tracking-[0.38em] text-[#8D8580]">
              Платформа
            </span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#DED5CE] bg-white/75 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6E6661] shadow-sm sm:px-4 sm:text-[11px]">
            <ShieldCheck className="size-4 text-[#7B2330]" aria-hidden="true" />
            <span className="hidden sm:inline">Демонстрационный режим</span>
            <span className="sm:hidden">Режим показа</span>
          </span>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="pb-11 pt-12 text-center sm:pb-14 sm:pt-16 sm:text-left lg:pb-14 lg:pt-14"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#DCCBC8] bg-[#7B2330]/[0.055] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7B2330] sm:text-[11px]">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>
              Цифровая система <IBuroBrand className="normal-case tracking-normal" />
            </span>
          </span>
          <h1 className="platform-display mx-auto mt-7 max-w-5xl text-[clamp(3.4rem,7.5vw,7rem)] leading-[1.05] tracking-[-0.022em] text-[#1D1D1F] sm:mx-0">
            Выберите
            <span className="block text-[#7B2330]">профиль</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#66605C] sm:mx-0 sm:mt-7 sm:text-xl sm:leading-9">
            Выберите профиль, чтобы посмотреть интерфейс клиента или сотрудника.
          </p>
        </motion.section>

        <motion.section
          aria-label="Профили пользователей"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="grid gap-5 pb-12 md:grid-cols-2 xl:grid-cols-5"
        >
          {DEMO_IDENTITIES.map((identity) => (
            <ProfilePreviewCard
              key={identity.id}
              identity={identity}
              onSelect={() => {
                selectIdentity(identity);
                router.push(
                  identity.role === "MANAGER" ? "/app/manager" : identity.role === "LAWYER" ? "/app/lawyer" : "/app/client",
                );
              }}
            />
          ))}
        </motion.section>
      </div>
    </main>
  );
}
