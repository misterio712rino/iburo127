import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const scripts = packageJson.scripts ?? {};

const expected = {
  "maintenance:run:task-reminders": "node scripts/run-maintenance-job.mjs task-reminders",
  "maintenance:run:questionnaire-reminders": "node scripts/run-maintenance-job.mjs questionnaire-reminders",
} as const;

for (const [name, command] of Object.entries(expected)) {
  assert.equal(scripts[name], command, `${name} must remain wired to the generic maintenance runner`);
}

console.log("MAINTENANCE_PACKAGE_SCRIPT_CONTRACT_PASS");
