import "server-only";

import type { AuthSession, SessionProvider } from "@/server/auth/contracts";

export type ExternalAuthIdentity = {
  provider: string;
  subject: string;
};

export interface ExternalSessionReader {
  getExternalIdentity(): Promise<ExternalAuthIdentity | null>;
}

export interface AuthIdentityResolver {
  resolveInternalUserId(identity: ExternalAuthIdentity): Promise<string | null>;
}

export class MappedSessionProvider implements SessionProvider {
  constructor(
    private readonly sessionReader: ExternalSessionReader,
    private readonly identityResolver: AuthIdentityResolver,
  ) {}

  async getSession(): Promise<AuthSession | null> {
    const externalIdentity = await this.sessionReader.getExternalIdentity();
    if (!externalIdentity) return null;

    const userId = await this.identityResolver.resolveInternalUserId(externalIdentity);
    if (!userId) return null;

    return { userId };
  }
}
