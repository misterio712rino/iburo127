import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const expectedNode = readFileSync(".nvmrc", "utf8").trim();
const expectedNpm = readFileSync(".npm-version", "utf8").trim();
const failures = [];

if (!/^\d+\.\d+\.\d+$/.test(expectedNode)) {
  failures.push(".nvmrc must contain an exact semantic version");
}
if (!/^\d+\.\d+\.\d+$/.test(expectedNpm)) {
  failures.push(".npm-version must contain an exact semantic version");
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
