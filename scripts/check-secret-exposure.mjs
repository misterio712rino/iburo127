import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const MAX_TEXT_BYTES = 1024 * 1024;
const ALLOWED_ENV_FILES = new Set([".env.example"]);
const allowlist = JSON.parse(
  readFileSync(resolve(process.cwd(), "security/secret-exposure-allowlist.json"), "utf8"),
);

const detectors = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["openai-key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["bitrix-webhook", /https:\/\/[^/\s]+\.bitrix24\.[^/\s]+\/rest\/\d+\/[A-Za-z0-9_-]{8,}/i],
  ["hardcoded-bearer", /(?:authorization|bearer)["'\s:=]+Bearer\s+[A-Za-z0-9._-]{20,}/i],
];

function isAllowed(relativePath, detector) {
  return Array.isArray(allowlist[relativePath]) && allowlist[relativePath].includes(detector);
}

function trackedFiles() {
  const output = execFileSync("git", ["-C", root, "ls-files", "-z"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output.split("\0").filter(Boolean);
}

const violations = [];
let scanned = 0;

for (const relativePath of trackedFiles()) {
  const name = basename(relativePath);
  if (/^\.env(?:\.|$)/.test(name) && !ALLOWED_ENV_FILES.has(name)) {
    violations.push(`${relativePath}: tracked environment file is forbidden`);
    continue;
  }

  const absolutePath = resolve(root, relativePath);
  let stat;
  try { stat = statSync(absolutePath); } catch { continue; }
  if (!stat.isFile() || stat.size > MAX_TEXT_BYTES) continue;

  let source;
  try { source = readFileSync(absolutePath, "utf8"); } catch { continue; }
  if (source.includes("\u0000")) continue;
  scanned += 1;

  for (const [detector, pattern] of detectors) {
    if (pattern.test(source) && !isAllowed(relativePath, detector)) {
      violations.push(`${relativePath}: ${detector} detector matched`);
    }
  }

  if (basename(relativePath) !== ".env.example") {
    const detector = "credentialed-database-url";
    const pattern = /postgres(?:ql)?:\/\/[^:\s/@]+:[^@\s/]+@/i;
    if (pattern.test(source) && !isAllowed(relativePath, detector)) {
      violations.push(`${relativePath}: ${detector} detector matched`);
    }
  }
}

if (violations.length > 0) {
  console.error("SECRET_EXPOSURE_POLICY_FAIL");
  for (const violation of violations) console.error(violation);
  process.exit(1);
}

console.log(`SECRET_EXPOSURE_POLICY_PASS: ${scanned} tracked text file(s) scanned`);
