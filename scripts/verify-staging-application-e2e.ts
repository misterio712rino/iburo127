import "dotenv/config";

import { spawn } from "node:child_process";
import {
  createStagingAuthenticatedSessions,
  STAGING_SESSION_COOKIE_ENV_NAMES,
  StagingAuthSessionFailure,
  type StagingAuthenticatedSessions,
} from "./staging-authenticated-sessions";

const FAIL = "STAGING_APPLICATION_E2E_FAIL";

const VERIFIERS = [
  ["HTTP authorization", "scripts/verify-staging-http-authz.ts"],
  ["AI authorization", "scripts/verify-staging-ai-http-authz.ts"],
  ["mutation and audit", "scripts/verify-staging-http-mutation-audit.ts"],
] as const;

function fail(message: string): never {
  throw new Error(message);
}

function assertNoPreSuppliedCoreCookies(env: NodeJS.ProcessEnv): void {
  if (STAGING_SESSION_COOKIE_ENV_NAMES.some((name) => Boolean(env[name]?.trim()))) {
    fail(
      "active application E2E refuses pre-supplied CLIENT/LAWYER/MANAGER cookies; fresh sessions must be created from staging credentials",
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
  };
}

async function runVerifier(
  label: string,
  scriptPath: string,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", scriptPath],
      {
        cwd: process.cwd(),
        env,
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
  console.log("AUTH_SESSIONS: fresh CLIENT/LAWYER/MANAGER sessions retained in memory for E2E");

  const verifierEnv = buildVerifierEnvironment(sessions);
  for (const [label, scriptPath] of VERIFIERS) {
    await runVerifier(label, scriptPath, verifierEnv);
    console.log(`E2E_PHASE: ${label} verified`);
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
