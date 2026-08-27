import "server-only";

import {
  MappedSessionProvider,
  type ExternalSessionReader,
} from "@/server/auth/provider-boundary";
import { PrismaAuthIdentityResolver } from "@/server/repositories/prisma/auth-identity-resolver";

const identityResolver = new PrismaAuthIdentityResolver();

export function createMappedSessionProvider(sessionReader: ExternalSessionReader) {
  return new MappedSessionProvider(sessionReader, identityResolver);
}
