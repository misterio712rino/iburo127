import "dotenv/config";

import { spawn } from "node:child_process";
import {
  createStagingAuthenticatedSessions,
  STAGING_SESSION_COOKIE_ENV_NAMES,
  StagingAuthSessionFailure,
  type StagingAuthenticatedSessions,
} from "./staging-authenticated-sessions";
import { requireStagingHttpTarget } from "./staging-http-target-guard";

const FAIL = "STAGING_APPLICATION_E2E_FAIL";
const OPAQUE_CASE_COMPAT_PRELOAD = "./scripts/staging-e2e-opaque-case-compat.mjs";
const INTERNAL_CASE_NUMBER = /^IBR?-/iu;
const EXACT_GIT_SHA_PATTERN = /^[a-f0-9]{40}$/;

type VerifierSpec = readonly [
  label: string,
  scriptPath: string,
  envOverrides?: Readonly<Record<string, string>>,
];

type CaseData = {
  id: string;
  caseNumber: string;
};

type CasesEnvelope = {
  ok: boolean;
  data?: CaseData[];
};

type OpaqueCaseFixtureIds = {
  sharedClientLawyerCaseId: string;
  clientOnlyCaseId: string;
  lawyerOnlyCaseId: string;
};

const RAW_HTTP_AUTHZ_VERIFIER: VerifierSpec = [
  "HTTP authorization",
  "scripts/verify-staging-http-authz.ts",
];

const COMPAT_VERIFIERS: readonly VerifierSpec[] = [
  ["portal navigation", "scripts/verify-staging-portal-navigation.ts"],
  ["access gate", "scripts/verify-staging-access-gate.ts"],
  ["AI authorization", "scripts/verify-staging-ai-http-authz.ts"],
  ["files lifecycle", "scripts/verify-staging-file-lifecycle.ts"],
  [
    "mutation and audit",
    "scripts/verify-staging-http-mutation-audit.ts",
    { IB_STAGING_FILES_E2E: "0", IB_STAGING_FILE_SCAN_E2E: "0" },
  ],
];

function fail(message: string): never {
  throw new Error(message);
}

function assertNoPreSuppliedCoreCookies(env: NodeJS.ProcessEnv): void {
  if (STAGING_SESSION_COOKIE_ENV_NAMES.some((name) => Boolean(env[name]?.trim()))) {
    fail(
      "active application E2E refuses pre-supplied CLIENT/OTHER_CLIENT/LAWYER/MANAGER cookies; fresh sessions must be created from staging credentials",
    );
  }
}

function buildVerifierEnvironment(
  sessions: StagingAuthenticatedSessions,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    IB_STAGING_CLIENT_COOKIE: sessions.cookies.CLIENT,
    IB_STAGING_LAWYER_COOKIE: sessions.cookies.LAWYER,
    IB_STAGING_MANAGER_COOKIE: sessions.cookies.MANAGER,
    ...(sessions.cookies.OTHER_CLIENT
      ? { IB_STAGING_OTHER_CLIENT_COOKIE: sessions.cookies.OTHER_CLIENT }
      : {}),
  };
}

async function listRawCases(
  label: string,
  cookie: string,
  baseUrl: URL,
): Promise<CaseData[]> {
  const response = await fetch(new URL("/api/platform/cases", baseUrl), {
    method: "GET",
    headers: {
      accept: "application/json",
      cookie,
    },
    redirect: "manual",
  });
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (!cacheControl.includes("no-store")) {
    fail(`${label} opaque fixture discovery is missing no-store cache policy`);
  }
  if (response.status !== 200) {
    fail(`${label} opaque fixture discovery expected 200, got ${response.status}`);
  }

  let body: CasesEnvelope;
  try {
    body = (await response.json()) as CasesEnvelope;
  } catch {
    fail(`${label} opaque fixture discovery returned non-JSON`);
  }
  if (!body.ok || !Array.isArray(body.data)) {
    fail(`${label} opaque fixture discovery returned invalid payload`);
  }

  const seenIds = new Set<string>();
  for (const [index, item] of body.data.entries()) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) {
      fail(`${label} opaque fixture item ${index} is missing an id`);
    }
    if (seenIds.has(item.id)) {
      fail(`${label} opaque fixture discovery returned duplicate id`);
    }
    seenIds.add(item.id);
    if (typeof item.caseNumber !== "string") {
      fail(`${label} opaque fixture item ${index} returned non-string caseNumber`);
    }
    if (INTERNAL_CASE_NUMBER.test(item.caseNumber.trim())) {
      fail(`${label} opaque fixture discovery observed an internal case number`);
    }
  }
  return body.data;
}

async function deriveOpaqueCaseFixtureIds(
  env: NodeJS.ProcessEnv,
): Promise<OpaqueCaseFixtureIds> {
  const baseUrl = requireStagingHttpTarget(env);
  const clientCookie = env.IB_STAGING_CLIENT_COOKIE?.trim();
  const lawyerCookie = env.IB_STAGING_LAWYER_COOKIE?.trim();
  const managerCookie = env.IB_STAGING_MANAGER_COOKIE?.trim();
  if (!clientCookie || !lawyerCookie || !managerCookie) {
    fail("opaque fixture discovery requires fresh CLIENT/LAWYER/MANAGER sessions");
  }

  const [clientCases, lawyerCases, managerCases] = await Promise.all([
    listRawCases("CLIENT", clientCookie, baseUrl),
    listRawCases("LAWYER", lawyerCookie, baseUrl),
    listRawCases("MANAGER", managerCookie, baseUrl),
  ]);

  if (clientCases.length !== 2) {
    fail(`opaque fixture discovery expected exactly 2 CLIENT cases, got ${clientCases.length}`);
  }

  const clientIds = new Set(clientCases.map((item) => item.id));
  const lawyerIds = new Set(lawyerCases.map((item) => item.id));
  const managerIds = new Set(managerCases.map((item) => item.id));

  const sharedClientLawyerCases = clientCases.filter((item) => lawyerIds.has(item.id));
  const clientOnlyCases = clientCases.filter((item) => !lawyerIds.has(item.id));
  const lawyerOnlyCases = lawyerCases
    .filter((item) => !clientIds.has(item.id))
    .sort((left, right) => left.id.localeCompare(right.id));

  if (sharedClientLawyerCases.length !== 1) {
    fail(
      `opaque fixture discovery expected exactly 1 CLIENT/LAWYER shared case, got ${sharedClientLawyerCases.length}`,
    );
  }
  if (clientOnlyCases.length !== 1) {
    fail(`opaque fixture discovery expected exactly 1 CLIENT-only case, got ${clientOnlyCases.length}`);
  }
  if (lawyerOnlyCases.length < 1) {
    fail("opaque fixture discovery requires at least 1 LAWYER-only case");
  }

  for (const item of clientCases) {
    if (!managerIds.has(item.id)) {
      fail("opaque fixture discovery found a CLIENT case hidden from MANAGER");
    }
  }
  for (const item of lawyerCases) {
    if (!managerIds.has(item.id)) {
      fail("opaque fixture discovery found a LAWYER case hidden from MANAGER");
    }
  }

  console.log(
    "OPAQUE_CASE_FIXTURES: shared CLIENT/LAWYER, CLIENT-only and LAWYER-only ids derived from raw role scopes",
  );
  return {
    sharedClientLawyerCaseId: sharedClientLawyerCases[0].id,
    clientOnlyCaseId: clientOnlyCases[0].id,
    lawyerOnlyCaseId: lawyerOnlyCases[0].id,
  };
}

function buildOpaqueCaseCompatibilityEnvironment(
  env: NodeJS.ProcessEnv,
  fixtureIds: OpaqueCaseFixtureIds,
): NodeJS.ProcessEnv {
  const exactSha = env.GITHUB_SHA?.trim() ?? "";
  if (!EXACT_GIT_SHA_PATTERN.test(exactSha)) {
    fail("opaque case compatibility requires an exact lowercase GITHUB_SHA");
  }

  return {
    ...env,
    IB_STAGING_OPAQUE_CASE_COMPAT: "1",
    IB_STAGING_OPAQUE_CASE_COMPAT_CONFIRM: `OPAQUE_CASE_COMPAT:${exactSha}`,
    IB_STAGING_CLIENT_CASE_NUMBER: fixtureIds.sharedClientLawyerCaseId,
    IB_STAGING_CLIENT_UNASSIGNED_CASE_NUMBER: fixtureIds.clientOnlyCaseId,
    IB_STAGING_LAWYER_CASE_NUMBER: fixtureIds.lawyerOnlyCaseId,
    IB_STAGING_CLIENT_AI_CASE_NUMBER: fixtureIds.sharedClientLawyerCaseId,
    IB_STAGING_CLIENT_SECOND_AI_CASE_NUMBER: fixtureIds.clientOnlyCaseId,
    IB_STAGING_MUTATION_CASE_NUMBER: fixtureIds.sharedClientLawyerCaseId,
  };
}

async function runVerifier(
  label: string,
  scriptPath: string,
  env: NodeJS.ProcessEnv,
  envOverrides?: Readonly<Record<string, string>>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", scriptPath],
      {
        cwd: process.cwd(),
        env: { ...env, ...envOverrides },
        stdio: "inherit",
        shell: false,
      },
    );

    child.once("error", () => {
      reject(new Error(`${label} verifier could not start`));
    });
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          signal
            ? `${label} verifier terminated by signal`
            : `${label} verifier exited unsuccessfully`,
        ),
      );
    });
  });
}

async function runOpaqueCompatVerifier(
  label: string,
  scriptPath: string,
  env: NodeJS.ProcessEnv,
  envOverrides?: Readonly<Record<string, string>>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--import", OPAQUE_CASE_COMPAT_PRELOAD, scriptPath],
      {
        cwd: process.cwd(),
        env: { ...env, ...envOverrides },
        stdio: "inherit",
        shell: false,
      },
    );

    child.once("error", () => {
      reject(new Error(`${label} verifier could not start`));
    });
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          signal
            ? `${label} verifier terminated by signal`
            : `${label} verifier exited unsuccessfully`,
        ),
      );
    });
  });
}

let sessions: StagingAuthenticatedSessions | null = null;
let failure: string | null = null;

try {
  assertNoPreSuppliedCoreCookies(process.env);
  sessions = await createStagingAuthenticatedSessions({
    onStatus: (message) => console.log(message),
  });
  console.log("TRUST_DEVICE: disabled for all TOTP verification requests");
  console.log("STAGING_AUTH_FLOW_PASS");
  console.log("AUTH_SESSIONS: fresh staging sessions retained in memory for E2E");

  const verifierEnv = buildVerifierEnvironment(sessions);
  const [rawLabel, rawScriptPath, rawEnvOverrides] = RAW_HTTP_AUTHZ_VERIFIER;
  await runVerifier(rawLabel, rawScriptPath, verifierEnv, rawEnvOverrides);
  console.log(`E2E_PHASE: ${rawLabel} verified on raw authenticated transport`);

  const fixtureIds = await deriveOpaqueCaseFixtureIds(verifierEnv);
  const opaqueCompatEnv = buildOpaqueCaseCompatibilityEnvironment(verifierEnv, fixtureIds);
  for (const [label, scriptPath, envOverrides] of COMPAT_VERIFIERS) {
    await runOpaqueCompatVerifier(label, scriptPath, opaqueCompatEnv, envOverrides);
    console.log(`E2E_PHASE: ${label} verified with opaque case-id fixture compatibility`);
  }
} catch (error) {
  failure =
    error instanceof StagingAuthSessionFailure || error instanceof Error
      ? error.message
      : "unexpected application E2E failure";
} finally {
  if (sessions) {
    try {
      await sessions.cleanup({ strict: true });
      console.log("AUTH_SESSIONS: fresh staging sessions revoked");
    } catch {
      failure = failure
        ? `${failure}; staging session cleanup failed`
        : "staging session cleanup failed";
    }
  }
}

if (failure) {
  console.error(`${FAIL}: ${failure}`);
  process.exitCode = 1;
} else {
  console.log("STAGING_APPLICATION_E2E_PASS");
}
