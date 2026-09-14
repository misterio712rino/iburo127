import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AUTH_SCHEMA = "public";
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;

const FIXTURES = [
  {
    label: "CLIENT",
    email: "client.individual@example.test",
    emailEnv: "IB_STAGING_CLIENT_EMAIL",
    passwordEnv: "IB_STAGING_CLIENT_PASSWORD",
  },
  {
    label: "LAWYER",
    email: "lawyer.demo@example.test",
    emailEnv: "IB_STAGING_LAWYER_EMAIL",
    passwordEnv: "IB_STAGING_LAWYER_PASSWORD",
  },
  {
    label: "MANAGER",
    email: "manager.demo@example.test",
    emailEnv: "IB_STAGING_MANAGER_EMAIL",
    passwordEnv: "IB_STAGING_MANAGER_PASSWORD",
  },
] as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

function exactPreviewCommitSha(env: NodeJS.ProcessEnv): string | null {
  const value = env.VERCEL_GIT_COMMIT_SHA?.trim();
  return value && EXACT_GIT_SHA_PATTERN.test(value) ? value.toLowerCase() : null;
}

function isExactStagingPreview(env: NodeJS.ProcessEnv): boolean {
  return (
    env.VERCEL_ENV?.trim() === "preview" &&
    env.VERCEL_GIT_COMMIT_REF?.trim() === VERCEL_STAGING_BRANCH &&
    env.IB_RUNTIME_TARGET?.trim() === "staging" &&
    exactPreviewCommitSha(env) !== null &&
    isVercelPreviewBackendAllowed(env)
  );
}

function safePasswordReady(value: string | undefined): boolean {
  if (value === undefined) return false;
  return (
    value.length >= 12 &&
    value.length <= 128 &&
    value === value.trim() &&
    !/[\r\n\0]/.test(value)
  );
}

function authSecretReady(value: string | undefined): boolean {
  if (value === undefined) return false;
  return value.length >= 32 && value === value.trim() && !/[\r\n\0]/.test(value);
}

function authOriginReady(value: string | undefined): boolean {
  const raw = value?.trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
    const loopback =
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    const secure = parsed.protocol === "https:" || (loopback && parsed.protocol === "http:");
    const originOnly =
      (parsed.pathname === "/" || parsed.pathname === "") &&
      !parsed.search &&
      !parsed.hash &&
      !parsed.username &&
      !parsed.password;
    const nonProductionHost =
      hostname !== "iburo127.ru" && !hostname.endsWith(".iburo127.ru");
    return secure && originOnly && nonProductionHost;
  } catch {
    return false;
  }
}

export async function GET() {
  const env = process.env;
  if (!isExactStagingPreview(env)) {
    return Response.json(
      {
        service: "iburo127",
        probe: "staging-auth-config",
        pass: false,
        failureStage: "preview-boundary",
      },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  let target: ReturnType<typeof requireStagingDatabaseTarget>;
  try {
    target = requireStagingDatabaseTarget(env);
  } catch {
    return Response.json(
      {
        service: "iburo127",
        probe: "staging-auth-config",
        pass: false,
        failureStage: "target",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const fixtureChecks = Object.fromEntries(
    FIXTURES.flatMap((fixture) => [
      [
        `${fixture.label.toLowerCase()}EmailReady`,
        env[fixture.emailEnv]?.trim().toLowerCase() === fixture.email,
      ],
      [
        `${fixture.label.toLowerCase()}PasswordReady`,
        safePasswordReady(env[fixture.passwordEnv]),
      ],
    ]),
  );

  const checks = {
    schemaReady: env.IB_STAGING_BETTER_AUTH_SCHEMA?.trim() === AUTH_SCHEMA,
    bootstrapConfirmationReady:
      env.IB_STAGING_AUTH_FIXTURE_BOOTSTRAP_CONFIRM?.trim() ===
      `AUTH-FIXTURES:${target.expectedDatabaseName}:${AUTH_SCHEMA}`,
    ...fixtureChecks,
    authSecretReady: authSecretReady(env.BETTER_AUTH_SECRET),
    authOriginReady: authOriginReady(env.BETTER_AUTH_URL),
  };
  const pass = Object.values(checks).every((value) => value === true);

  return Response.json(
    {
      service: "iburo127",
      probe: "staging-auth-config",
      environment: "preview",
      branch: VERCEL_STAGING_BRANCH,
      commitSha: exactPreviewCommitSha(env),
      runtimeTarget: "staging",
      database: target.expectedDatabaseName,
      schema: AUTH_SCHEMA,
      checks,
      sensitiveValuesReturned: false,
      readOnly: true,
      pass,
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}
