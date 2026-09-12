import { BookOpen, ClipboardCheck, FileText, UserCheck } from "lucide-react";

import { PlatformCard } from "@/components/platform/PlatformPrimitives";
import type { DashboardActivity } from "@/lib/platform/types";

const ACTIVITY_ICONS: Record<DashboardActivity["type"], typeof BookOpen> = {
  lesson: BookOpen,
  questionnaire: ClipboardCheck,
  document: FileText,
  lawyer: UserCheck,
};

export function ActivityFeed({ activity }: { activity: readonly DashboardActivity[] }) {
  return (
    <PlatformCard className="p-6 sm:p-8">
      <h2 className="text-2xl font-semibold tracking-[-0.04em]">Последняя активность</h2>
      <div className="mt-7 divide-y divide-border">
        {activity.map((event) => {
          const Icon = ACTIVITY_ICONS[event.type];
          return <div key={event.id} className="flex gap-4 py-4 first:pt-0 last:pb-0"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-muted text-primary"><Icon className="size-4" aria-hidden="true" /></span><div className="min-w-0"><p className="text-sm font-medium leading-6">{event.text}</p><p className="mt-1 text-xs text-muted-foreground">{event.dateLabel}</p></div></div>;
        })}
      </div>
    </PlatformCard>
  );
}
