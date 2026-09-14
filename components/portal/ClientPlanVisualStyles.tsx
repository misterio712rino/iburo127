import type { PlanCode } from "@/lib/platform/types";
import { ClientAccountVisualStyles } from "@/components/portal/ClientAccountVisualStyles";
import { ClientCaseSwitcherStyles } from "@/components/portal/ClientCaseSwitcherStyles";
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
        <ClientCaseSwitcherStyles />
      </>
    );
  }

  if (planCode === "PRO") {
    return (
      <>
        <ProClientVisualStyles />
        <DarkClientStatusStyles />
        <ClientAccountVisualStyles />
        <ClientCaseSwitcherStyles />
      </>
    );
  }

  return (
    <>
      <LiteClientVisualStyles />
      <ClientAccountVisualStyles />
      <ClientCaseSwitcherStyles />
    </>
  );
}
