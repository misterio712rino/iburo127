import "server-only";

import { headers } from "next/headers";
import type {
  BetterAuthSessionLoader,
  BetterAuthVerifiedSession,
} from "@/server/auth/better-auth-session-reader";

export type BetterAuthApiSessionReader = {
  getSession(input: { headers: Headers }): Promise<BetterAuthVerifiedSession | null>;
};

/**
 * Adapts Better Auth's server API to the minimal verified-session loader used by
 * the provider-neutral authentication boundary.
 *
 * The result is memoized for the lifetime of this loader so authentication and
 * MFA policy checks in one request observe the same verified Better Auth session.
 */
export function createBetterAuthNextSessionLoader(
  authApi: BetterAuthApiSessionReader,
): BetterAuthSessionLoader {
  let sessionPromise: Promise<BetterAuthVerifiedSession | null> | null = null;

  return () => {
    sessionPromise ??= (async () =>
      authApi.getSession({
        headers: await headers(),
      }))();
    return sessionPromise;
  };
}
