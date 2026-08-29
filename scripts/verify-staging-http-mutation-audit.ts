import "dotenv/config";

import {
  requireStagingHttpMutationPreflight,
  STAGING_HTTP_MUTATION_PREFLIGHT_FAIL,
} from "@/scripts/staging-http-mutation-preflight";

try {
  requireStagingHttpMutationPreflight(process.env);
  await import("./verify-staging-http-mutation-audit-impl");
} catch (error) {
  const message = error instanceof Error ? error.message : STAGING_HTTP_MUTATION_PREFLIGHT_FAIL;
  console.error(
    message.startsWith(STAGING_HTTP_MUTATION_PREFLIGHT_FAIL)
      ? message
      : "STAGING_HTTP_MUTATION_AUDIT_FAIL: verifier execution failed",
  );
  process.exitCode = 1;
}
