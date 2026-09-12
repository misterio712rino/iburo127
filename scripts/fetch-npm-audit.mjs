import { writeFile } from "node:fs/promises";

import { retrieveNpmAuditReport } from "./npm-audit-retrieval.mjs";

const outputPath = process.argv[2];
if (!outputPath) {
  console.error("DEPENDENCY_AUDIT_RETRIEVAL_FAIL: missing report output path");
  process.exit(1);
}

try {
  const result = await retrieveNpmAuditReport({
    onRetry: ({ attempt, reason }) => {
      console.warn(`DEPENDENCY_AUDIT_RETRY: attempt=${attempt + 1}/3 reason=${reason}`);
    },
  });
  await writeFile(outputPath, result.raw, "utf8");
  console.log(`DEPENDENCY_AUDIT_RETRIEVAL_PASS: attempts=${result.attempt} npm_exit=${result.exitCode ?? "unavailable"}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "DEPENDENCY_AUDIT_RETRIEVAL_FAIL: unavailable");
  process.exit(1);
}
