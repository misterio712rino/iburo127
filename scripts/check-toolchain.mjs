import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const nvmrc = readFileSync(".nvmrc", "utf8").trim();

const expectedNode = packageJson.engines?.node;
const expectedNpm = packageJson.engines?.npm;
const expectedPackageManager = packageJson.packageManager;

const failures = [];

if (!/^\d+\.\d+\.\d+$/.test(nvmrc)) {
  failures.push(".nvmrc must contain an exact semantic version");
}
if (expectedNode !== nvmrc) {
  failures.push(`package.json engines.node must exactly match .nvmrc (${nvmrc})`);
}
if (!/^\d+\.\d+\.\d+$/.test(expectedNpm ?? "")) {
  failures.push("package.json engines.npm must contain an exact semantic version");
}
if (expectedPackageManager !== `npm@${expectedNpm}`) {
  failures.push("package.json packageManager must exactly match engines.npm");
}

const actualNode = process.versions.node;
let actualNpm = "unknown";
try {
  actualNpm = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
} catch {
  failures.push("npm executable is unavailable");
}

if (actualNode !== expectedNode) {
  failures.push(`Node runtime mismatch: expected ${expectedNode}, got ${actualNode}`);
}
if (actualNpm !== expectedNpm) {
  failures.push(`npm runtime mismatch: expected ${expectedNpm}, got ${actualNpm}`);
}

if (failures.length > 0) {
  console.error("TOOLCHAIN_POLICY_FAIL");
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

console.log(`TOOLCHAIN_POLICY_PASS: node=${actualNode} npm=${actualNpm}`);
