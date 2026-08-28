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
 * This file deliberately depends only on the shape of auth.api.getSession so
 * the Better Auth package/config can be wired later without leaking provider
 * types through the domain layer.
 */
export function createBetterAuthNextSessionLoader(
  authApi: BetterAuthApiSessionReader,
): BetterAuthSessionLoader {
  return async () =>
    authApi.getSession({
      headers: await headers(),
    });
}
