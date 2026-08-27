import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PLAN_LABEL } from "@/lib/platform/themes";
import type { PlanCode } from "@/lib/platform/types";

export function PlatformCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("platform-glass rounded-[1.4rem] border border-border bg-card text-card-foreground shadow-[0_18px_50px_rgba(0,0,0,.06)]", className)} {...props} />;
}

export function PlanBadge({ plan }: { plan: PlanCode }) {
  return <span className="plan-badge inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold tracking-[.12em]">{PLAN_LABEL[plan]}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${value}%` }} /></div>;
}

export function ProfileAvatar({ initials, className }: { initials: string; className?: string }) {
  return <span className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground", className)} aria-hidden="true">{initials}</span>;
}

export function SectionHeader({ title, description, action }: { title: ReactNode; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="platform-display text-4xl leading-[1.05] tracking-[-.022em] sm:text-5xl">{title}</h1>{description ? <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{description}</p> : null}</div>{action}</div>;
}

export function MetricCard({ label, value }: { label: string; value: string | number }) {
  return <PlatformCard className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold tracking-[-.04em]">{value}</p></PlatformCard>;
}
