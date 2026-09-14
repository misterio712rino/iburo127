import type { ReactNode } from "react";
import { ClientCaseFrame, type ClientCaseOption } from "@/components/portal/ClientCaseFrame";
import { ClientPlanVisualStyles } from "@/components/portal/ClientPlanVisualStyles";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { getPlanDisplayLabel } from "@/lib/platform/case-progress";
import { resolveCasePortalAudience } from "@/lib/platform/case-portal-audience";
import type { PlanCode } from "@/lib/platform/types";
import { getCurrentAccountProfile } from "@/server/account/operations";
import type { SessionProvider } from "@/server/auth/contracts";
import { clientCaseService } from "@/server/client-cases/runtime";
import type { AuthenticatedActor, ClientCaseRecord } from "@/server/domain/client-cases/contracts";

function requirePlanCode(value: string): PlanCode {
  if (value === "LITE" || value === "PRO" || value === "INDIVIDUAL") return value;
  throw new Error("UNSUPPORTED_CLIENT_PLAN");
}

export async function CasePortalFrame({
  children,
  sessionProvider,
  actor,
  clientCase,
  sectionLabel,
  accessLabel = "Доступ подтверждён",
  showStaffTasks = false,
  showProspectLeads = false,
}: {
  children: ReactNode;
  sessionProvider: SessionProvider;
  actor: AuthenticatedActor;
  clientCase: ClientCaseRecord;
  sectionLabel: string;
  accessLabel?: string;
  showStaffTasks?: boolean;
  showProspectLeads?: boolean;
}) {
  const audience = resolveCasePortalAudience(actor, clientCase);

  if (audience === "CLIENT" && clientCase.clientId === actor.userId) {
    const [profile, allCases] = await Promise.all([
      getCurrentAccountProfile(sessionProvider),
      clientCaseService.listCases(actor),
    ]);
    const ownedCases = allCases.filter((item) => item.clientId === actor.userId);
    const caseOptions: ClientCaseOption[] = ownedCases.map((item) => ({
      id: item.id,
      caseNumber: item.caseNumber,
      planLabel: getPlanDisplayLabel(item.planCode, "CLIENT"),
    }));
    const planCode = requirePlanCode(clientCase.planCode);

    return (
      <>
        <ClientPlanVisualStyles planCode={planCode} />
        <ClientCaseFrame
          caseId={clientCase.id}
          caseNumber={clientCase.caseNumber}
          displayName={profile.displayName?.trim() || "Клиент iБюро"}
          planLabel={getPlanDisplayLabel(clientCase.planCode, "CLIENT")}
          cases={caseOptions}
        >
          {children}
        </ClientCaseFrame>
      </>
    );
  }

  return (
    <PortalFrame
      sectionLabel={sectionLabel}
      accessLabel={accessLabel}
      showStaffTasks={showStaffTasks}
      showProspectLeads={showProspectLeads}
    >
      {children}
    </PortalFrame>
  );
}
