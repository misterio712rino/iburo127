import "server-only";

import {
  MappedSessionProvider,
  type ExternalSessionReader,
} from "@/server/auth/provider-boundary";
import {
  BetterAuthExternalSessionReader,
  type BetterAuthSessionLoader,
} from "@/server/auth/better-auth-session-reader";
import { PrismaAuthIdentityResolver } from "@/server/repositories/prisma/auth-identity-resolver";

const identityResolver = new PrismaAuthIdentityResolver();

export function createMappedSessionProvider(sessionReader: ExternalSessionReader) {
  return new MappedSessionProvider(sessionReader, identityResolver);
}

export function createBetterAuthSessionProvider(loadSession: BetterAuthSessionLoader) {
  return createMappedSessionProvider(new BetterAuthExternalSessionReader(loadSession));
}
