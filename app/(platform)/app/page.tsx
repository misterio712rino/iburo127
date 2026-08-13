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

  return (
    <motion.button
      type="button"
      data-preview-theme={theme}
      onClick={onSelect}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="profile-preview group flex min-h-[21rem] w-full flex-col overflow-hidden rounded-[2rem] border p-6 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7B2330]/25 sm:p-8"
    >
      <span className="profile-preview__accent" aria-hidden="true" />

      <span className="flex w-full items-start justify-between gap-4">
        <span className="flex items-center gap-3">
          <ProfileAvatar initials={identity.initials} className="size-12" />
          <span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] opacity-55">
              {identity.role === "LAWYER" ? "Сотрудник" : "Клиент"}
            </span>
            <span className="mt-1 block text-sm font-medium opacity-80">
              {meta.label}
            </span>
          </span>
        </span>
        {identity.plan ? (
          <PlanBadge plan={identity.plan} />
        ) : (
          <span className="profile-preview__staff-mark grid size-10 place-items-center rounded-2xl">
            <BriefcaseBusiness aria-hidden="true" />
          </span>
        )}
      </span>

      <span className="profile-preview__window mt-8 block w-full rounded-[1.25rem] border p-4">
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold">
            <PreviewIcon className="size-4" aria-hidden="true" />
            {identity.role === "LAWYER" ? "Активные дела" : "Прогресс дела"}
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

      <span className="mt-auto flex w-full items-end justify-between gap-5 pt-8">
        <span className="min-w-0">
          <span className="block text-2xl font-bold tracking-[-0.04em] sm:text-[1.7rem]">
            {identity.displayName}
          </span>
          <span className="mt-2 block text-sm opacity-65">
            {identity.role === "LAWYER"
              ? "Юрист · Кабинет сотрудника"
              : `Тариф ${PLAN_LABEL[identity.plan!]}`}
          </span>
          {identity.caseNumber ? (
            <span className="mt-3 block font-mono text-[11px] font-medium tracking-[0.04em] opacity-55">
              Дело {identity.caseNumber}
            </span>
          ) : null}
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
    <main className="demo-entry relative min-h-screen overflow-hidden bg-[#F7F5F2] px-5 py-7 text-[#1D1D1F] sm:px-8 sm:py-10 lg:px-12">
      <div className="demo-entry__glow demo-entry__glow--top" aria-hidden="true" />
      <div className="demo-entry__glow demo-entry__glow--bottom" aria-hidden="true" />

      <div className="relative mx-auto max-w-[90rem]">
        <header className="flex items-center justify-between gap-5 border-b border-[#DED5CE]/80 pb-7">
          <div className="flex flex-col leading-none">
            <span className="text-[34px] font-bold tracking-[-0.055em] text-[#1D1D1F] sm:text-[40px]">
              iБюро<span className="text-[#7B2330]">.</span>
            </span>
            <span className="mt-2 text-[9px] font-semibold uppercase tracking-[0.38em] text-[#8D8580]">
              Платформа
            </span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#DED5CE] bg-white/75 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6E6661] shadow-sm sm:px-4 sm:text-[11px]">
            <ShieldCheck className="size-4 text-[#7B2330]" aria-hidden="true" />
            <span className="hidden sm:inline">Демонстрационный режим</span>
            <span className="sm:hidden">Демо</span>
          </span>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="pb-14 pt-16 sm:pb-20 sm:pt-24 lg:pb-24 lg:pt-28"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#DCCBC8] bg-[#7B2330]/[0.055] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7B2330] sm:text-[11px]">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Демо платформы iБюро
          </span>
          <h1 className="mt-7 max-w-5xl text-[clamp(3rem,7vw,6.5rem)] font-bold leading-[0.94] tracking-[-0.065em] text-[#1D1D1F]">
            Демонстрация
            <span className="block text-[#7B2330]">платформы</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[#66605C] sm:text-xl sm:leading-9">
            Выберите профиль, чтобы посмотреть интерфейс клиента или сотрудника.
          </p>
        </motion.section>

        <motion.section
          aria-label="Демонстрационные профили"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="grid gap-5 pb-12 md:grid-cols-2 xl:grid-cols-4"
        >
          {DEMO_IDENTITIES.map((identity) => (
            <ProfilePreviewCard
              key={identity.id}
              identity={identity}
              onSelect={() => {
                selectIdentity(identity);
                router.push(
                  identity.role === "LAWYER" ? "/app/lawyer" : "/app/client",
                );
              }}
            />
          ))}
        </motion.section>
      </div>
    </main>
  );
}
