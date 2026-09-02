import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const maintenanceRoot = resolve("app/api/internal/maintenance");
const expectedJobs = [
  "ai-audit-health",
  "file-scan-health",
  "file-scans",
  "notification-deliveries",
  "notification-delivery-health",
  "questionnaire-reminders",
  "stale-upload-health",
  "stale-uploads",
  "task-reminders",
] as const;

const routeDirectories = (await readdir(maintenanceRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

assert.deepEqual(
  routeDirectories,
  [...expectedJobs].sort(),
  "maintenance route inventory must remain explicit so a new internal endpoint cannot bypass the security contract",
);

for (const job of expectedJobs) {
  const route = await readFile(resolve(maintenanceRoot, job, "route.ts"), "utf8");

  assert.match(route, /export const dynamic = "force-dynamic";/, `${job} must stay dynamic`);
  assert.match(route, /export async function POST\(request: Request\)/, `${job} must expose POST`);
  assert.doesNotMatch(
    route,
    /export (?:async )?function (?:GET|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/,
    `${job} must not expose an unaudited HTTP method`,
  );
  assert.match(route, /Cache-Control": "no-store"/, `${job} responses must remain no-store`);

  assert.match(
    route,
    /=\s*readMaintenanceRuntimeConfig\(\)[\s\S]*?isAuthorizedMaintenanceRequest\(request,\s*[A-Za-z_$][\w$]*\.secret\)[\s\S]*?code:\s*"UNAUTHORIZED"[\s\S]*?401/,
    `${job} must validate maintenance config before Bearer auth and fail closed with 401`,
  );
}

const runner = await readFile(resolve("scripts/run-maintenance-job.mjs"), "utf8");
for (const job of expectedJobs) {
  assert.match(
    runner,
    new RegExp(`"${job}": "\\/api\\/internal\\/maintenance\\/${job}"`),
    `${job} must remain mapped by the generic maintenance runner`,
  );
}
assert.match(runner, /method: "POST"/);
assert.match(runner, /Authorization: `Bearer \$\{secret\}`/);
assert.match(runner, /redirect: "error"/);

const auth = await readFile(resolve("server/maintenance/auth.ts"), "utf8");
assert.match(auth, /startsWith\("Bearer "\)/, "maintenance auth must require the Bearer scheme");
assert.match(auth, /createHash\("sha256"\)/, "maintenance auth must normalize comparison length through hashing");
assert.match(auth, /timingSafeEqual\(hash\(token\), hash\(expectedSecret\)\)/, "maintenance secret comparison must remain timing-safe");

console.log("MAINTENANCE_ROUTE_SECURITY_CONTRACT_PASS");
