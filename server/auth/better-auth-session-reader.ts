import "server-only";

import type {
  ExternalAuthIdentity,
  ExternalSessionReader,
} from "@/server/auth/provider-boundary";

export const BETTER_AUTH_PROVIDER = "better-auth";

export type BetterAuthVerifiedSession = {
  user: {
    id: string;
    twoFactorEnabled?: boolean | null;
  };
};

export type BetterAuthSessionLoader = () => Promise<BetterAuthVerifiedSession | null>;

/**
 * Bridges a server-verified Better Auth session into the provider-neutral
 * identity boundary without making Better Auth's user id the legal-domain User.id.
 *
 * The injected loader must perform the real Better Auth server-side session
 * verification. This class intentionally accepts only the minimum verified
 * session shape required for identity mapping.
 */
export class BetterAuthExternalSessionReader implements ExternalSessionReader {
  constructor(private readonly loadSession: BetterAuthSessionLoader) {}

  async getExternalIdentity(): Promise<ExternalAuthIdentity | null> {
    const session = await this.loadSession();
    const subject = session?.user.id.trim();
    if (!subject) return null;

    return {
      provider: BETTER_AUTH_PROVIDER,
      subject,
    };
  }
}
