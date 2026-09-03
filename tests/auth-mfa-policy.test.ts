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
const betterAuthRouteSource = await readFile(resolve("app/api/auth/[...all]/route.ts"), "utf8");
const accessGateSource = await readFile(resolve("server/auth/access-gate.ts"), "utf8");
const accessGateRateLimitSource = await readFile(
  resolve("server/auth/access-gate-rate-limit.ts"),
  "utf8",
);
const accessGateRouteSource = await readFile(resolve("app/api/public/access-gate/route.ts"), "utf8");
const accessGateSignInSource = await readFile(resolve("app/api/public/access-gate/sign-in/route.ts"), "utf8");
const signInFormSource = await readFile(resolve("components/platform/auth/SignInForm.tsx"), "utf8");
const managerLeadsSource = await readFile(resolve("app/portal/leads/page.tsx"), "utf8");
const managerLeadOperationsSource = await readFile(
  resolve("server/prospect-leads/operations.ts"),
  "utf8",
);
const rootPageSource = await readFile(resolve("app/(public)/page.tsx"), "utf8");
const schemaSource = await readFile(resolve("prisma/schema.prisma"), "utf8");
const leadMigrationSource = await readFile(
  resolve("prisma/migrations/20260901_access_gate_leads/migration.sql"),
  "utf8",
);

assert.match(betterAuthSource, /disableSignUp:\s*true/, "self-service registration must remain disabled");
assert.doesNotMatch(signInFormSource, /Зарегистр/i, "sign-in UI must not expose a registration action");
assert.doesNotMatch(accessGateRouteSource, /signUp|sign-up/i, "access gate must never create an auth account");
assert.doesNotMatch(accessGateSignInSource, /signUp|sign-up/i, "access-gate sign-in must never expose signup");
assert.match(
  betterAuthRouteSource,
  /ACCESS_GATE_ONLY_PATHS[\s\S]*?\/api\/auth\/sign-in\/email/,
  "direct Better Auth email sign-in must be reserved for the server-side access-gate flow",
);
assert.match(
  betterAuthRouteSource,
  /isAccessGateOnlyPath\(request\)[\s\S]*?ACCESS_GATE_REQUIRED/,
  "public Better Auth catch-all must fail closed for direct email/password sign-in",
);
assert.match(signInFormSource, /\/api\/public\/access-gate\/sign-in/);
assert.match(signInFormSource, /Телефон или электронная почта/);
assert.match(signInFormSource, /https:\/\/iburo127\.ru\//);
assert.match(signInFormSource, /href="\/privacy"/);
assert.match(rootPageSource, /redirect\("\/auth\/sign-in"\)/);
assert.match(schemaSource, /model PotentialClientLead/);
assert.match(leadMigrationSource, /CREATE TABLE "PotentialClientLead"/);

assert.match(
  accessGateSource,
  /from "@\/server\/auth\/access-gate-rate-limit"/,
  "access gate must use the reviewed shared rate-limit helper",
);
assert.match(
  accessGateRateLimitSource,
  /createHmac\("sha256", secret\)/,
  "rate-limit keys must remain HMAC protected",
);
assert.match(
  accessGateRateLimitSource,
  /ACCESS_GATE_RATE_LIMIT_KEY_PREFIX = "iburo:access-gate:v1"/,
  "rate-limit key namespace must remain stable",
);
assert.match(
  accessGateRateLimitSource,
  /request\.headers\.get\("x-forwarded-for"\)/,
  "Vercel-overwritten client IP header must drive IP throttling",
);
assert.match(accessGateSource, /readTrustedAccessGateClientIp\(request\)/);
assert.match(accessGateSource, /RATE_LIMIT_IP_MAX = 30/);
assert.match(accessGateSource, /RATE_LIMIT_CONTACT_MAX = 6/);
assert.match(accessGateSource, /insert into "rateLimit"/, "access gate must use shared database-backed rate-limit storage");
assert.match(accessGateSource, /on conflict \("key"\) do update/);
assert.match(accessGateSource, /accessGateRateLimitDigest\("ip"/);
assert.match(accessGateSource, /accessGateRateLimitDigest\("contact"/);
assert.doesNotMatch(schemaSource, /PotentialClientLead[\s\S]*?(?:ipAddress|ipHash|clientIp)/, "potential-lead records must not store raw or derived client IP data");
assert.match(accessGateRouteSource, /AccessGateRateLimitError/);
assert.match(accessGateRouteSource, /"RATE_LIMITED"/);
assert.match(accessGateRouteSource, /Retry-After/);
assert.match(accessGateSignInSource, /resolveAccessChallengeToEmail/);
assert.match(accessGateSignInSource, /\/api\/auth\/sign-in\/email/);
assert.doesNotMatch(accessGateSignInSource, /email\s*:\s*\(body/, "browser payload must not choose the resolved account email");
assert.match(managerLeadsSource, /actor\.roles\.includes\("MANAGER"\)/);
assert.match(managerLeadsSource, /listPotentialClientLeadsForManager\(sessionProvider\)/);
assert.doesNotMatch(
  managerLeadsSource,
  /potentialClientLead\.findMany|getPrismaClient/,
  "manager leads page must delegate database access to the reviewed server operation",
);
assert.match(managerLeadOperationsSource, /import "server-only"/);
assert.match(managerLeadOperationsSource, /requireServerActor\(sessionProvider\)/);
assert.match(managerLeadOperationsSource, /requireRole\(actor, "MANAGER"\)/);
assert.match(managerLeadOperationsSource, /potentialClientLead\.findMany/);

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

await import("./manager-leads-workspace-contract.test");

console.log("auth MFA and access-gate policy tests: PASS");
