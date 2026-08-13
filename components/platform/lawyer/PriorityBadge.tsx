import type { LawyerPriority } from "@/lib/platform/types";
import { getPriorityLabel } from "@/lib/platform/demo";
import { cn } from "@/lib/utils";

export function PriorityBadge({ priority }: { priority: LawyerPriority }) {
  return <span className={cn("inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold", priority === "high" ? "border-primary/30 bg-primary/10 text-primary" : priority === "medium" ? "border-border bg-muted text-foreground" : "border-border text-muted-foreground")}>{getPriorityLabel(priority)} приоритет</span>;
}
