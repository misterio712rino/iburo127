import { createProductionSessionProvider } from "@/server/auth/production-session-provider";
import { getCurrentPlatformActor } from "@/server/client-cases/operations";
import {
  executePlatformIdentityOperation,
  toPlatformActorTransport,
} from "@/server/client-cases/transport";

export async function GET() {
  const sessionProvider = createProductionSessionProvider();
  return executePlatformIdentityOperation(async () =>
    toPlatformActorTransport(await getCurrentPlatformActor(sessionProvider)),
  );
}
