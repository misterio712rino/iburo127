import { readFileSync } from "node:fs";

const policy = JSON.parse(readFileSync("security/install-scripts-policy.json", "utf8"));
const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
const npmrc = readFileSync(".npmrc", "utf8");

const failures = [];
const expectedNames = Object.keys(policy).sort();

const strictLine = npmrc
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith("strict-allow-scripts="));
if (strictLine !== "strict-allow-scripts=true") {
  failures.push(".npmrc must set strict-allow-scripts=true");
}

const allowLine = npmrc
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith("allow-scripts="));
const allowedNames = (allowLine?.slice("allow-scripts=".length) ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .sort();

if (JSON.stringify(allowedNames) !== JSON.stringify(expectedNames)) {
  failures.push(
    `.npmrc allow-scripts must exactly match policy names: ${expectedNames.join(",")}`,
  );
}

for (const [name, entry] of Object.entries(policy)) {
  const expectedVersion = entry?.version;
  const lockfilePath = entry?.lockfilePath;

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(expectedVersion ?? "")) {
    failures.push(`${name}: policy version must be exact, got ${expectedVersion ?? "missing"}`);
    continue;
  }
  if (typeof lockfilePath !== "string" || !lockfilePath.startsWith("node_modules/")) {
    failures.push(`${name}: invalid lockfilePath`);
    continue;
  }

  const actualVersion = lockfile.packages?.[lockfilePath]?.version;
  if (actualVersion !== expectedVersion) {
    failures.push(
      `${name}: lockfile ${lockfilePath} version ${actualVersion ?? "missing"} != approved ${expectedVersion}`,
    );
  }
}

if (failures.length > 0) {
  console.error("INSTALL_SCRIPTS_POLICY_FAIL");
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(
  `INSTALL_SCRIPTS_POLICY_PASS: ${expectedNames.length} approved dependency install script package(s) pinned`,
);
