import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function ClientCaseModuleIntro({
  caseId,
  caseNumber,
  title,
  description,
  icon: Icon,
  action,
}: {
  caseId: string;
  caseNumber: string;
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="client-module-intro">
      <Link
        href={`/portal/cases/${caseId}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Назад к делу
      </Link>

      <div className="mt-4 flex min-w-0 flex-col gap-4 sm:mt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-muted text-primary sm:size-12">
            <Icon className="size-5 sm:size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold tracking-[0.08em] text-muted-foreground">{caseNumber}</p>
            <h1 className="mt-2 break-words font-[var(--font-iburo-display)] text-3xl font-semibold leading-none text-foreground sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
