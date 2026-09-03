import type { PlanCode } from "@/lib/platform/types";
import { DarkClientStatusStyles } from "@/components/portal/DarkClientStatusStyles";
import { IndividualClientVisualStyles } from "@/components/portal/IndividualClientVisualStyles";
import { LiteClientVisualStyles } from "@/components/portal/LiteClientVisualStyles";
import { ProClientVisualStyles } from "@/components/portal/ProClientVisualStyles";

export function ClientPlanVisualStyles({ planCode }: { planCode: PlanCode }) {
  if (planCode === "INDIVIDUAL") {
    return (
      <>
        <IndividualClientVisualStyles />
        <DarkClientStatusStyles />
      </>
    );
  }

  if (planCode === "PRO") {
    return (
      <>
        <ProClientVisualStyles />
        <DarkClientStatusStyles />
      </>
    );
  }

  return <LiteClientVisualStyles />;
}
