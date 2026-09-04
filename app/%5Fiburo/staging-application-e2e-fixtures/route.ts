import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, type PoolClient } from "pg";

import { PrismaClient } from "@/generated/prisma/client";
import { requireStagingDatabaseTarget } from "@/scripts/staging-target-guard";
import { normalizeAccessIdentifier } from "@/server/auth/access-gate-core";
import {
  accessGateRateLimitDigest,
  readTrustedAccessGateClientIp,
} from "@/server/auth/access-gate-rate-limit";
import { readBetterAuthRuntimeConfig } from "@/server/config/production";
import { getPrivateObjectStorage } from "@/server/files/object-storage-runtime";
import {
  VERCEL_STAGING_BRANCH,
  isVercelPreviewBackendAllowed,
} from "@/server/config/vercel-preview-boundary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCHEMA = "public";
const ADVISORY_LOCK_KEY = "iburo127:staging:application-e2e-fixtures:v1";
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/i;
const MUTATION_CASE_NUMBER = "IBR-2026-009901";
const MUTATION_TASK_ID = "12700000-9901-4000-8000-000000000001";
const CLIENT_EMAIL = "client.individual@example.test";
const LAWYER_EMAIL = "lawyer.demo@example.test";
const MANAGER_EMAIL = "manager.demo@example.test";
const PLAN_CODE = "INDIVIDUAL";
const STAGE_CODE = "DOCUMENT_PREPARATION";
const DOCUMENT_CODE = "property-inventory";
const FILES_E2E_FIXTURE_NAME = "iburo-staging-e2e.pdf";
const FILES_E2E_FIXTURE_MIME_TYPE = "application/pdf";
const MAX_FILES_E2E_FIXTURES = 4;
const OPENED_AT = new Date("2026-09-01T00:00:00.000Z");

type FailureStage =
  | "preview-boundary"
  | "target"
  | "configuration"
  | "origin"
  | "confirmation"
  | "connect"
  | "lock"
  | "identity"
  | "fixture-cleanup"
  | "fixture";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

const HTML_HEADERS = {
  ...NO_STORE_HEADERS,
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
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

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function fail(stage: FailureStage, status = 503) {
  return safeJson(status, {
    service: "iburo127",
    operation: "staging-application-e2e-fixtures",
    pass: false,
    failureStage: stage,
  });
}

function newPrisma(databaseUrl: string) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

function isDemoSeedConfigured(env: NodeJS.ProcessEnv, databaseName: string): boolean {
  return env.IB_STAGING_DEMO_SEED_CONFIRM?.trim() === `DEMO-SEED:${databaseName}`;
}

function isPrivateStagingBucketConfirmed(request: Request, env: NodeJS.ProcessEnv): boolean {
  return (
    env.IB_STAGING_PRIVATE_BUCKET_CONFIRM?.trim() ===
    `PRIVATE_STAGING_BUCKET:${new URL(request.url).host}`
  );
}

function buildAccessGateRateLimitKeys(
  request: Request,
  commitSha: string,
  env: NodeJS.ProcessEnv,
): string[] {
  const { secret } = readBetterAuthRuntimeConfig(env);
  const clientIp = readTrustedAccessGateClientIp(request);
  const prospectEmail = `staging.e2e.${commitSha.slice(0, 16)}@example.test`;
  const contacts = [CLIENT_EMAIL, LAWYER_EMAIL, MANAGER_EMAIL, prospectEmail].map(
    (email) => normalizeAccessIdentifier(email).contactKey,
  );
  return [
    accessGateRateLimitDigest("ip", clientIp, secret),
    ...contacts.map((contactKey) => accessGateRateLimitDigest("contact", contactKey, secret)),
  ];
}

function platformRoleCodes(
  roles: Array<{ role: { code: string } }>,
): string[] {
  return roles
    .map((entry) => entry.role.code)
    .filter((code) => code === "CLIENT" || code === "LAWYER" || code === "MANAGER");
}

async function readDatabaseIdentity(
  databaseUrl: string,
  expectedDatabaseName: string,
): Promise<boolean> {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
    max: 1,
  });
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    const result = await client.query<{ database_name: string; current_schema: string | null }>(
      "select current_database() as database_name, current_schema() as current_schema",
    );
    await client.query("ROLLBACK");
    const row = result.rows[0];
    return row?.database_name === expectedDatabaseName && row.current_schema === SCHEMA;
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original read-only failure.
      }
    }
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

async function inspectDependencies(prisma: PrismaClient) {
  const [client, lawyer, plan, stage, existingCase, existingTask] = await Promise.all([
    prisma.user.findUnique({
      where: { email: CLIENT_EMAIL },
      select: {
        id: true,
        status: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    }),
    prisma.user.findUnique({
      where: { email: LAWYER_EMAIL },
      select: {
        id: true,
        status: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    }),
    prisma.plan.findUnique({
      where: { code: PLAN_CODE },
      select: { id: true, isActive: true },
    }),
    prisma.caseStage.findUnique({
      where: { code: STAGE_CODE },
      select: { id: true, isActive: true },
    }),
    prisma.clientCase.findUnique({
      where: { caseNumber: MUTATION_CASE_NUMBER },
      select: { id: true, clientId: true, assignedLawyerId: true },
    }),
    prisma.caseTask.findUnique({
      where: { id: MUTATION_TASK_ID },
      select: { id: true, clientCaseId: true, assigneeId: true, status: true, version: true },
    }),
  ]);

  const clientRoles = client ? platformRoleCodes(client.roles) : [];
  const lawyerRoles = lawyer ? platformRoleCodes(lawyer.roles) : [];
  const dependenciesReady =
    client?.status === "ACTIVE" &&
    clientRoles.length === 1 &&
    clientRoles[0] === "CLIENT" &&
    lawyer?.status === "ACTIVE" &&
    lawyerRoles.length === 1 &&
    lawyerRoles[0] === "LAWYER" &&
    plan?.isActive === true &&
    stage?.isActive === true;

  const caseCollision = Boolean(existingCase && client && existingCase.clientId !== client.id);
  const taskCollision = Boolean(
    existingTask &&
      existingCase &&
      (existingTask.clientCaseId !== existingCase.id ||
        (lawyer && existingTask.assigneeId !== lawyer.id)),
  );

  return {
    dependenciesReady,
    caseState: existingCase ? (caseCollision ? "collision" : "present") : "missing",
    taskState: existingTask
      ? taskCollision
        ? "collision"
        : existingTask.status === "NEW"
          ? "ready"
          : "needs-reset"
      : "missing",
    safeToReset: dependenciesReady && !caseCollision && !taskCollision,
  };
}

/**
 * Removes only uploads created by the guarded files E2E fixture. The fixture
 * name is intentionally unique, and every candidate is additionally bound to
 * the dedicated mutation case, its primary CLIENT owner, and that case's
 * generated object-key namespace. Storage is removed before the row, so this
 * route never reports a successful reset while a private object remains.
 */
async function cleanupFilesE2eFixtures(
  prisma: PrismaClient,
  input: { clientCaseId: string; clientId: string },
): Promise<number> {
  const files = await prisma.storedFile.findMany({
    where: {
      clientCaseId: input.clientCaseId,
      uploadedById: input.clientId,
      fileName: FILES_E2E_FIXTURE_NAME,
      mimeType: FILES_E2E_FIXTURE_MIME_TYPE,
    },
    select: {
      id: true,
      clientCaseId: true,
      uploadedById: true,
      storageProvider: true,
      objectKey: true,
      fileName: true,
      mimeType: true,
    },
    orderBy: { createdAt: "asc" },
    take: MAX_FILES_E2E_FIXTURES + 1,
  });

  if (files.length > MAX_FILES_E2E_FIXTURES) {
    throw new Error("too many guarded files E2E fixtures");
  }
  if (files.length === 0) return 0;

  const storage = getPrivateObjectStorage();
  const objectKeyPrefix = `cases/${input.clientCaseId}/`;

  for (const file of files) {
    if (
      file.storageProvider !== storage.providerCode ||
      !file.objectKey.startsWith(objectKeyPrefix)
    ) {
      throw new Error("guarded files E2E fixture storage identity mismatch");
    }

    // Check first so an earlier partial reset (object gone, row present) can
    // be retried safely without broad storage deletion.
    if (await storage.statObject(file.objectKey)) {
      await storage.deleteObject(file.objectKey);
    }

    const deleted = await prisma.storedFile.deleteMany({
      where: {
        id: file.id,
        clientCaseId: input.clientCaseId,
        uploadedById: input.clientId,
        objectKey: file.objectKey,
        fileName: FILES_E2E_FIXTURE_NAME,
        mimeType: FILES_E2E_FIXTURE_MIME_TYPE,
      },
    });
    if (deleted.count !== 1) {
      throw new Error("guarded files E2E fixture database cleanup failed");
    }
  }

  return files.length;
}

export async function GET() {
  const env = process.env;
  if (!isExactStagingPreview(env)) return fail("preview-boundary", 404);

  let target: ReturnType<typeof requireStagingDatabaseTarget>;
  try {
    target = requireStagingDatabaseTarget(env);
  } catch {
    return fail("target");
  }

  const configurationReady = isDemoSeedConfigured(env, target.expectedDatabaseName);
  let identityPass = false;
  let inspection: Awaited<ReturnType<typeof inspectDependencies>>;
  const prisma = newPrisma(target.databaseUrl);
  try {
    identityPass = await readDatabaseIdentity(target.databaseUrl, target.expectedDatabaseName);
    inspection = await inspectDependencies(prisma);
  } catch {
    return fail("connect");
  } finally {
    await prisma.$disconnect();
  }

  const sha = exactPreviewCommitSha(env);
  const safeToReset = Boolean(sha) && configurationReady && identityPass && inspection.safeToReset;
  const requestConfirmation = sha
    ? `RESET_APPLICATION_E2E:${target.expectedDatabaseName}:${SCHEMA}:${sha}`
    : "";
  const form = safeToReset
    ? `<form method="post"><input type="hidden" name="confirm" value="${htmlEscape(requestConfirmation)}"><button type="submit">Reset guarded staging application E2E fixtures</button></form>`
    : "";

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>iБюро staging application E2E fixtures</title></head><body><main><h1>iБюро staging application E2E fixtures</h1><p>${safeToReset ? "All guarded preconditions passed. POST reset is enabled." : "Reset is blocked because one or more guarded preconditions failed."}</p><ul><li>environment: preview</li><li>branch: ${htmlEscape(VERCEL_STAGING_BRANCH)}</li><li>commit: ${htmlEscape(sha ?? "unavailable")}</li><li>database: ${htmlEscape(target.expectedDatabaseName)}</li><li>schema: ${SCHEMA}</li><li>demo confirmation ready: ${String(configurationReady)}</li><li>database identity pass: ${String(identityPass)}</li><li>dependencies ready: ${String(inspection.dependenciesReady)}</li><li>mutation case: ${MUTATION_CASE_NUMBER}</li><li>case state: ${inspection.caseState}</li><li>task state: ${inspection.taskState}</li><li>read only: true</li></ul>${form}</main></body></html>`,
    { status: 200, headers: HTML_HEADERS },
  );
}

export async function POST(request: Request) {
  const env = process.env;
  if (!isExactStagingPreview(env)) return fail("preview-boundary", 404);

  let target: ReturnType<typeof requireStagingDatabaseTarget>;
  try {
    target = requireStagingDatabaseTarget(env);
  } catch {
    return fail("target");
  }

  if (!isDemoSeedConfigured(env, target.expectedDatabaseName)) {
    return fail("configuration");
  }

  const filesE2eEnabled = env.IB_STAGING_FILES_E2E?.trim() === "1";
  if (filesE2eEnabled && !isPrivateStagingBucketConfirmed(request, env)) {
    return fail("configuration");
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (origin !== requestUrl.origin && secFetchSite !== "same-origin") {
    return fail("origin", 403);
  }

  const sha = exactPreviewCommitSha(env);
  if (!sha) return fail("preview-boundary", 404);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("confirmation", 400);
  }
  const expectedConfirmation =
    `RESET_APPLICATION_E2E:${target.expectedDatabaseName}:${SCHEMA}:${sha}`;
  if (formData.get("confirm") !== expectedConfirmation) {
    return fail("confirmation", 403);
  }

  let accessGateRateLimitKeys: string[];
  try {
    accessGateRateLimitKeys = buildAccessGateRateLimitKeys(request, sha, env);
  } catch {
    return fail("configuration");
  }

  const lockPool = new Pool({
    connectionString: target.databaseUrl,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    max: 1,
  });
  let lockClient: PoolClient | null = null;
  let lockHeld = false;
  let failureStage: FailureStage = "connect";
  const prisma = newPrisma(target.databaseUrl);

  try {
    lockClient = await lockPool.connect();
    failureStage = "lock";
    await lockClient.query("select pg_advisory_lock(hashtext($1))", [ADVISORY_LOCK_KEY]);
    lockHeld = true;

    failureStage = "identity";
    const identity = await lockClient.query<{ database_name: string; current_schema: string | null }>(
      "select current_database() as database_name, current_schema() as current_schema",
    );
    const identityRow = identity.rows[0];
    if (
      identityRow?.database_name !== target.expectedDatabaseName ||
      identityRow.current_schema !== SCHEMA
    ) {
      throw new Error("staging database identity mismatch");
    }

    failureStage = "fixture-cleanup";
    const cleanupClient = await prisma.user.findUnique({
      where: { email: CLIENT_EMAIL },
      select: { id: true },
    });
    const cleanupCase = await prisma.clientCase.findUnique({
      where: { caseNumber: MUTATION_CASE_NUMBER },
      select: { id: true, clientId: true },
    });
    const filesDeleted =
      filesE2eEnabled && cleanupClient && cleanupCase && cleanupCase.clientId === cleanupClient.id
        ? await cleanupFilesE2eFixtures(prisma, {
            clientCaseId: cleanupCase.id,
            clientId: cleanupClient.id,
          })
        : 0;

    failureStage = "fixture";
    const reset = await prisma.$transaction(
      async (tx) => {
        const client = await tx.user.findUnique({
          where: { email: CLIENT_EMAIL },
          select: {
            id: true,
            status: true,
            roles: { select: { role: { select: { code: true } } } },
          },
        });
        const lawyer = await tx.user.findUnique({
          where: { email: LAWYER_EMAIL },
          select: {
            id: true,
            status: true,
            roles: { select: { role: { select: { code: true } } } },
          },
        });
        const plan = await tx.plan.findUnique({
          where: { code: PLAN_CODE },
          select: { id: true, isActive: true },
        });
        const stage = await tx.caseStage.findUnique({
          where: { code: STAGE_CODE },
          select: { id: true, isActive: true },
        });

        const clientRoles = client ? platformRoleCodes(client.roles) : [];
        const lawyerRoles = lawyer ? platformRoleCodes(lawyer.roles) : [];
        if (
          client?.status !== "ACTIVE" ||
          clientRoles.length !== 1 ||
          clientRoles[0] !== "CLIENT" ||
          lawyer?.status !== "ACTIVE" ||
          lawyerRoles.length !== 1 ||
          lawyerRoles[0] !== "LAWYER" ||
          plan?.isActive !== true ||
          stage?.isActive !== true
        ) {
          throw new Error("staging E2E dependencies are not ready");
        }

        const existingCase = await tx.clientCase.findUnique({
          where: { caseNumber: MUTATION_CASE_NUMBER },
          select: { id: true, clientId: true },
        });
        if (existingCase && existingCase.clientId !== client.id) {
          throw new Error("dedicated mutation case number collision");
        }

        const clientCase = existingCase
          ? await tx.clientCase.update({
              where: { id: existingCase.id },
              data: {
                planId: plan.id,
                stageId: stage.id,
                assignedLawyerId: lawyer.id,
                status: "ACTIVE",
                openedAt: OPENED_AT,
                closedAt: null,
              },
              select: { id: true },
            })
          : await tx.clientCase.create({
              data: {
                caseNumber: MUTATION_CASE_NUMBER,
                clientId: client.id,
                planId: plan.id,
                stageId: stage.id,
                assignedLawyerId: lawyer.id,
                status: "ACTIVE",
                openedAt: OPENED_AT,
              },
              select: { id: true },
            });

        const existingTask = await tx.caseTask.findUnique({
          where: { id: MUTATION_TASK_ID },
          select: { clientCaseId: true },
        });
        if (existingTask && existingTask.clientCaseId !== clientCase.id) {
          throw new Error("dedicated mutation task id collision");
        }

        let accessGateRateLimitsDeleted = 0;
        for (const key of accessGateRateLimitKeys) {
          accessGateRateLimitsDeleted += await tx.$executeRaw`
            delete from "rateLimit" where "key" = ${key}
          `;
        }

        const taskEventsDeleted = await tx.taskStatusEvent.deleteMany({
          where: { taskId: MUTATION_TASK_ID },
        });
        const questionnaireDeleted = await tx.caseQuestionnaire.deleteMany({
          where: { clientCaseId: clientCase.id },
        });
        const practicumDeleted = await tx.casePracticumProgress.deleteMany({
          where: { clientCaseId: clientCase.id },
        });
        const documentsDeleted = await tx.caseDocument.deleteMany({
          where: { clientCaseId: clientCase.id, documentCode: DOCUMENT_CODE },
        });

        const task = await tx.caseTask.upsert({
          where: { id: MUTATION_TASK_ID },
          update: {
            clientCaseId: clientCase.id,
            assigneeId: lawyer.id,
            title: "Staging application E2E mutation task",
            description: "Dedicated mutable fixture for guarded staging application E2E.",
            status: "NEW",
            dueAt: null,
            startedAt: null,
            completedAt: null,
            version: 1,
          },
          create: {
            id: MUTATION_TASK_ID,
            clientCaseId: clientCase.id,
            assigneeId: lawyer.id,
            title: "Staging application E2E mutation task",
            description: "Dedicated mutable fixture for guarded staging application E2E.",
            status: "NEW",
            version: 1,
          },
          select: { id: true, status: true, version: true },
        });

        return {
          accessGateRateLimitsDeleted,
          questionnaireDeleted: questionnaireDeleted.count,
          practicumDeleted: practicumDeleted.count,
          documentsDeleted: documentsDeleted.count,
          taskEventsDeleted: taskEventsDeleted.count,
          task,
        };
      },
      { timeout: 30_000 },
    );

    if (reset.task.status !== "NEW" || reset.task.version !== 1) {
      throw new Error("staging E2E task reset verification failed");
    }

    return safeJson(200, {
      service: "iburo127",
      operation: "staging-application-e2e-fixtures",
      environment: "preview",
      branch: VERCEL_STAGING_BRANCH,
      commitSha: sha,
      runtimeTarget: "staging",
      database: target.expectedDatabaseName,
      schema: SCHEMA,
      mutationCaseNumber: MUTATION_CASE_NUMBER,
      mutationTaskId: MUTATION_TASK_ID,
      taskStatus: reset.task.status,
      taskVersion: reset.task.version,
      reset: {
        accessGateRateLimitsDeleted: reset.accessGateRateLimitsDeleted,
        questionnaireDeleted: reset.questionnaireDeleted,
        practicumDeleted: reset.practicumDeleted,
        documentsDeleted: reset.documentsDeleted,
        taskEventsDeleted: reset.taskEventsDeleted,
        filesDeleted,
      },
      pass: true,
    });
  } catch {
    return fail(failureStage);
  } finally {
    if (lockHeld && lockClient) {
      try {
        await lockClient.query("select pg_advisory_unlock(hashtext($1))", [ADVISORY_LOCK_KEY]);
      } catch {
        // Connection teardown releases a session-level advisory lock if explicit unlock fails.
      }
    }
    lockClient?.release();
    await lockPool.end();
    await prisma.$disconnect();
  }
}
