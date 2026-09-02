import type { PlanCode } from "@/lib/platform/types";
import { IndividualClientVisualStyles } from "@/components/portal/IndividualClientVisualStyles";
import { LiteClientVisualStyles } from "@/components/portal/LiteClientVisualStyles";
import { ProClientVisualStyles } from "@/components/portal/ProClientVisualStyles";

export function ClientPlanVisualStyles({ planCode }: { planCode: PlanCode }) {
  if (planCode === "INDIVIDUAL") return <IndividualClientVisualStyles />;
  if (planCode === "PRO") return <ProClientVisualStyles />;
  return <LiteClientVisualStyles />;
}
