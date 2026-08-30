import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  ActorRepository,
  AuthSession,
  SessionProvider,
} from "@/server/auth/contracts";
import {
  requiresStaffMfa,
  StaffMfaEnforcingSessionProvider,
} from "@/server/auth/staff-mfa-policy";
import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";

const productionConfigSource = await readFile(resolve("server/config/production.ts"), "utf8");
assert.match(
  productionConfigSource,
  /parsed\.protocol === "https:" \|\|\s*\(parsed\.protocol === "http:" && parsed\.hostname === "localhost"\)/,
  "Better Auth base URL must be HTTPS or HTTP on localhost only",
);
assert.doesNotMatch(
  productionConfigSource,
  /parsed\.protocol === "https:" \|\| parsed\.hostname === "localhost"/,
  "localhost must not bypass the Better Auth protocol check",
);

class StaticSessionProvider implements SessionProvider {
  constructor(private readonly session: AuthSession | null) {}
  async getSession() {
    return this.session;
  }
}

class StaticActorRepository implements ActorRepository {
  constructor(private readonly actors: Record<string, AuthenticatedActor>) {}
  async getActiveActor(userId: string) {
    return this.actors[userId] ?? null;
  }
}

const actors: Record<string, AuthenticatedActor> = {
  client: { userId: "client", roles: ["CLIENT"] },
  lawyer: { userId: "lawyer", roles: ["LAWYER"] },
  manager: { userId: "manager", roles: ["MANAGER"] },
  mixed: { userId: "mixed", roles: ["CLIENT", "LAWYER"] },
};

assert.equal(requiresStaffMfa(actors.client, false), false);
assert.equal(requiresStaffMfa(actors.lawyer, false), true);
assert.equal(requiresStaffMfa(actors.manager, false), true);
assert.equal(requiresStaffMfa(actors.mixed, false), true);
assert.equal(requiresStaffMfa(actors.lawyer, true), false);

async function admitted(userId: string, mfaEnabled: boolean) {
  const provider = new StaffMfaEnforcingSessionProvider(
    new StaticSessionProvider({ userId }),
    new StaticActorRepository(actors),
    async () => mfaEnabled,
  );
  return provider.getSession();
}

assert.deepEqual(await admitted("client", false), { userId: "client" });
assert.equal(await admitted("lawyer", false), null);
assert.equal(await admitted("manager", false), null);
assert.equal(await admitted("mixed", false), null);
assert.deepEqual(await admitted("lawyer", true), { userId: "lawyer" });
assert.deepEqual(await admitted("manager", true), { userId: "manager" });

const unknownProvider = new StaffMfaEnforcingSessionProvider(
  new StaticSessionProvider({ userId: "unknown" }),
  new StaticActorRepository(actors),
  async () => true,
);
assert.equal(await unknownProvider.getSession(), null);

console.log("auth MFA policy tests: PASS");
