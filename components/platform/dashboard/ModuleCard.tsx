"use client";

import Link from "next/link";
import { BookOpen, Bot, ChartNoAxesColumnIncreasing, CheckCircle2, ClipboardList, FileText, Home, LockKeyhole } from "lucide-react";

import { ProgressBar } from "@/components/platform/PlatformPrimitives";
import type { DashboardModule, DashboardModuleCode } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

const MODULE_ICONS: Record<DashboardModuleCode, typeof BookOpen> = {
  PRACTICUM: BookOpen,
  QUESTIONNAIRE: ClipboardList,
  DOCUMENTS: FileText,
  CASE_PROGRESS: ChartNoAxesColumnIncreasing,
  MORTGAGE: Home,
  AI_ASSISTANT: Bot,
};

export function ModuleCard({ module }: { module: DashboardModule }) {
  const Icon = MODULE_ICONS[module.code];
  const locked = module.state === "locked";
  const href = module.code === "PRACTICUM" ? "/app/client/practicum" : module.code === "QUESTIONNAIRE" ? "/app/client/questionnaire" : module.code === "DOCUMENTS" ? "/app/client/documents" : module.code === "CASE_PROGRESS" ? "/app/client/progress" : module.code === "AI_ASSISTANT" ? "/app/client/ai" : undefined;
  const label = locked ? module.lockLabel : module.code === "PRACTICUM" ? "Открыть Практикум" : module.code === "QUESTIONNAIRE" ? "Открыть анкету" : module.code === "DOCUMENTS" ? "Открыть документы" : module.code === "CASE_PROGRESS" ? "Открыть прогресс дела" : module.code === "AI_ASSISTANT" ? "Открыть AI-помощник" : "Индивидуальная оценка специалистом";
  const className = cn(
    "group flex min-h-56 w-full flex-col rounded-[1.4rem] border border-border bg-card p-5 text-left text-card-foreground shadow-[0_14px_40px_rgba(0,0,0,.045)] transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
    href && "hover:-translate-y-1 hover:border-primary/35",
    module.state === "active" && "module-card-active border-primary/25",
    locked && "cursor-not-allowed opacity-65",
  );
  const content = <>
    <span className="flex w-full items-start justify-between gap-3">
      <span className="grid size-11 place-items-center rounded-2xl bg-muted text-primary"><Icon className="size-5" aria-hidden="true" /></span>
      {locked ? <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" /> : module.state === "completed" ? <CheckCircle2 className="size-5 text-primary" aria-hidden="true" /> : null}
    </span>
    <span className="mt-7 block text-lg font-semibold tracking-[-0.025em]">{module.title}</span>
    <span className="mt-2 block text-sm font-medium">{module.summary}</span>
    <span className="mt-2 block text-xs leading-5 text-muted-foreground">{module.detail}</span>
    <span className="mt-auto block w-full pt-5">
      {typeof module.progress === "number" ? <ProgressBar value={module.progress} /> : null}
      <span className="mt-3 block text-[11px] font-semibold text-muted-foreground">{label}</span>
    </span>
  </>;

  return href ? <Link href={href} className={className}>{content}</Link> : <article className={className}>{content}</article>;
}
