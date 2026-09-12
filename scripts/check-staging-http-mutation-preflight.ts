import "dotenv/config";

import {
  requireStagingHttpMutationPreflight,
  STAGING_HTTP_MUTATION_PREFLIGHT_FAIL,
} from "@/scripts/staging-http-mutation-preflight";

try {
  const result = requireStagingHttpMutationPreflight(process.env);
  console.log(
    `STAGING_HTTP_MUTATION_PREFLIGHT_PASS filesE2e=${result.filesE2e ? 1 : 0} fileScanE2e=${result.fileScanE2e ? 1 : 0} maxScanRuns=${result.fileScanMaxRuns}`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : STAGING_HTTP_MUTATION_PREFLIGHT_FAIL;
  console.error(
    message.startsWith(STAGING_HTTP_MUTATION_PREFLIGHT_FAIL)
      ? message
      : STAGING_HTTP_MUTATION_PREFLIGHT_FAIL,
  );
  process.exitCode = 1;
}
