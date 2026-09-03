import type { PlanCode } from "@/lib/platform/types";
import { ClientAccountVisualStyles } from "@/components/portal/ClientAccountVisualStyles";
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
        <ClientAccountVisualStyles />
      </>
    );
  }

  if (planCode === "PRO") {
    return (
      <>
        <ProClientVisualStyles />
        <DarkClientStatusStyles />
        <ClientAccountVisualStyles />
      </>
    );
  }

  return (
    <>
      <LiteClientVisualStyles />
      <ClientAccountVisualStyles />
    </>
  );
}
