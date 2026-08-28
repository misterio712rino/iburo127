import "server-only";

import { BetterAuthExternalSessionReader } from "@/server/auth/better-auth-session-reader";
import { createBetterAuthNextSessionLoader } from "@/server/auth/better-auth-next-session";
import { getBetterAuthInstance } from "@/server/auth/better-auth-instance";
import { createMappedSessionProvider } from "@/server/auth/provider-runtime";

export function createProductionSessionProvider() {
  const auth = getBetterAuthInstance();
  const loader = createBetterAuthNextSessionLoader(auth.api);
  return createMappedSessionProvider(new BetterAuthExternalSessionReader(loader));
}
