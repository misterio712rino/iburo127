"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlatformCard } from "@/components/platform/PlatformPrimitives";
import type { DashboardNextStep } from "@/lib/platform/types";

export function NextStepCard({ nextStep, href }: { nextStep: DashboardNextStep; href: string }) {
  return (
    <PlatformCard className="dashboard-next-step relative h-full overflow-hidden border-primary/35 bg-primary p-6 text-primary-foreground shadow-[0_24px_70px_color-mix(in_srgb,var(--primary)_26%,transparent)] sm:p-8">
      <Sparkles className="absolute -right-8 -top-8 size-44 opacity-[0.08]" aria-hidden="true" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] opacity-75">
          <span className="size-2 rounded-full bg-current" />
          Следующий шаг
        </div>
        <h2 className="mt-8 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl">
          {nextStep.title}
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-6 opacity-80 sm:text-base sm:leading-7">
          {nextStep.description}
        </p>
        <div className="mt-auto pt-8">
          <Button render={<Link href={href} />} nativeButton={false} size="lg" className="h-12 w-full rounded-full bg-primary-foreground px-6 text-primary hover:bg-primary-foreground/90 sm:w-auto">
            {nextStep.actionLabel}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </PlatformCard>
  );
}
