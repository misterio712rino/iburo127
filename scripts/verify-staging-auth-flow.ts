import "dotenv/config";

import {
  createStagingAuthenticatedSessions,
  StagingAuthSessionFailure,
  type StagingAuthenticatedSessions,
} from "./staging-authenticated-sessions";

const FAIL = "STAGING_AUTH_FLOW_FAIL";

let sessions: StagingAuthenticatedSessions | null = null;

try {
  sessions = await createStagingAuthenticatedSessions({
    onStatus: (message) => console.log(message),
  });
  await sessions.cleanup({ strict: true });
  sessions = null;
  console.log("TRUST_DEVICE: disabled for all TOTP verification requests");
  console.log("STAGING_AUTH_FLOW_PASS");
} catch (error) {
  if (sessions) {
    try {
      await sessions.cleanup();
    } catch {
      // Best-effort cleanup is intentionally silent on an already failing verifier.
    }
  }
  const message =
    error instanceof StagingAuthSessionFailure
      ? error.message
      : "unexpected verification failure";
  console.error(`${FAIL}: ${message}`);
  process.exitCode = 1;
}
