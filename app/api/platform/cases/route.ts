import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { listAccessibleClientCases } from "@/server/client-cases/operations";
import {
  executePlatformIdentityOperation,
  toClientCaseTransportRecord,
} from "@/server/client-cases/transport";

export async function GET() {
  const sessionProvider = createProductionSessionProvider();
  return executePlatformIdentityOperation(async () => {
    const cases = await listAccessibleClientCases(sessionProvider);
    return cases.map(toClientCaseTransportRecord);
  });
}
