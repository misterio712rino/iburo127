import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  ActorRepository,
  AuthSession,
  SessionProvider,
} from "@/server/auth/contracts";
import {
  issueAccessChallenge,
  normalizeAccessIdentifier,
  verifyAccessChallenge,
} from "@/server/auth/access-gate-core";
import {
  requiresStaffMfa,
  StaffMfaEnforcingSessionProvider,
} from "@/server/auth/staff-mfa-policy";
import type { AuthenticatedActor } from "@/server/domain/client-cases/contracts";

const productionConfigSource = await readFile(resolve("server/config/production.ts"), "utf8");
assert.match(
  productionConfigSource,
  /const secret = requireSafeCredential\(env, "BETTER_AUTH_SECRET"\);/,
  "Better Auth signing secret must use the control-character-safe credential reader",
);
assert.doesNotMatch(
  productionConfigSource,
  /const secret = requireEnv\(env, "BETTER_AUTH_SECRET"\);/,
  "Better Auth signing secret must not bypass credential sanitation",
);
assert.match(
  productionConfigSource,
  /function requireSafeCredential[\s\S]*?\/\[\\r\\n\\0\]\//,
  "safe credential reader must reject CR/LF/NUL",
);
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

const betterAuthSource = await readFile(resolve("server/auth/better-auth-instance.ts"), "utf8");
const signInFormSource = await readFile(resolve("components/platform/auth/SignInForm.tsx"), "utf8");
const rootPageSource = await readFile(resolve("app/(public)/page.tsx"), "utf8");
const schemaSource = await readFile(resolve("prisma/schema.prisma"), "utf8");
assert.match(betterAuthSource, /disableSignUp:\s*true/, "self-service registration must remain disabled");
assert.doesNotMatch(signInFormSource, /Зарегистр/i, "sign-in UI must not expose a registration action");
assert.match(signInFormSource, /Телефон или электронная почта/);
assert.match(signInFormSource, /https:\/\/iburo127\.ru\//);
assert.match(rootPageSource, /redirect\("\/auth\/sign-in"\)/);
assert.match(schemaSource, /model PotentialClientLead/);

const emailIdentifier = normalizeAccessIdentifier("  Client@Example.Test ");
assert.deepEqual(emailIdentifier, {
  type: "EMAIL",
  normalized: "client@example.test",
  contactKey: "email:client@example.test",
  email: "client@example.test",
  phone: null,
});
const phoneIdentifier = normalizeAccessIdentifier("8 (999) 123-45-67");
assert.equal(phoneIdentifier.type, "PHONE");
assert.equal(phoneIdentifier.normalized, "+79991234567");
assert.throws(() => normalizeAccessIdentifier("not-a-contact"));

const challengeSecret = "access-gate-contract-secret-0123456789";
const nowMs = Date.UTC(2026, 8, 1, 12, 0, 0);
const challenge = issueAccessChallenge({
  userId: "12700000-9901-4000-8000-000000000001",
  secret: challengeSecret,
  nowMs,
  ttlSeconds: 300,
});
assert.equal(
  verifyAccessChallenge({ challenge, secret: challengeSecret, nowMs: nowMs + 60_000 }).sub,
  "12700000-9901-4000-8000-000000000001",
);
assert.throws(() =>
  verifyAccessChallenge({ challenge, secret: challengeSecret, nowMs: nowMs + 301_000 }),
);
assert.throws(() =>
  verifyAccessChallenge({ challenge: `${challenge}x`, secret: challengeSecret, nowMs }),
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

console.log("auth MFA and access-gate policy tests: PASS");
