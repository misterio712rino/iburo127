import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const MAX_TEXT_BYTES = 1024 * 1024;
const ALLOWED_ENV_FILES = new Set([".env.example"]);
const allowlist = JSON.parse(
  readFileSync(resolve(root, "security/secret-history-allowlist.json"), "utf8"),
);

const detectors = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["openai-key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["bitrix-webhook", /https:\/\/[^/\s]+\.bitrix24\.[^/\s]+\/rest\/\d+\/[A-Za-z0-9_-]{8,}/i],
  ["hardcoded-bearer", /(?:authorization|bearer)["'\s:=]+Bearer\s+[A-Za-z0-9._-]{20,}/i],
  ["credentialed-database-url", /postgres(?:ql)?:\/\/[^:\s/@]+:[^@\s/]+@/i],
];

function git(args, options = {}) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: options.encoding ?? "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
  });
}

function isAllowed(blobSha, detector) {
  return Array.isArray(allowlist[blobSha]) && allowlist[blobSha].includes(detector);
}

const shallow = git(["rev-parse", "--is-shallow-repository"]).trim();
if (shallow !== "false") {
  console.error("SECRET_HISTORY_EXPOSURE_POLICY_FAIL: repository history is shallow");
  process.exit(1);
}

const historicalPaths = new Set(
  git(["log", "--format=", "--name-only", "HEAD"])
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean),
);

const violations = [];
for (const path of historicalPaths) {
  const name = basename(path);
  if (/^\.env(?:\.|$)/.test(name) && !ALLOWED_ENV_FILES.has(name)) {
    violations.push(`${path}: tracked environment file existed in candidate history`);
  }
}

const objectLines = git(["rev-list", "--objects", "HEAD"])
  .split(/\r?\n/)
  .filter(Boolean);
const pathByObject = new Map();
const objectIds = [];
for (const line of objectLines) {
  const space = line.indexOf(" ");
  const oid = space === -1 ? line : line.slice(0, space);
  const path = space === -1 ? null : line.slice(space + 1);
  if (!pathByObject.has(oid) && path) pathByObject.set(oid, path);
  objectIds.push(oid);
}

const check = spawnSync(
  "git",
  ["-C", root, "cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
  { input: `${[...new Set(objectIds)].join("\n")}\n`, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
if (check.status !== 0) {
  process.stderr.write(check.stderr || "SECRET_HISTORY_EXPOSURE_POLICY_FAIL: git cat-file check failed\n");
  process.exit(1);
}

const blobs = check.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [oid, type, sizeText] = line.split(" ");
    return { oid, type, size: Number(sizeText) };
  })
  .filter((item) => item.type === "blob" && Number.isFinite(item.size) && item.size <= MAX_TEXT_BYTES);

let scanned = 0;
for (let index = 0; index < blobs.length; index += 25) {
  const chunk = blobs.slice(index, index + 25);
  const batch = spawnSync("git", ["-C", root, "cat-file", "--batch"], {
    input: `${chunk.map((item) => item.oid).join("\n")}\n`,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (batch.status !== 0 || !batch.stdout) {
    process.stderr.write(batch.stderr?.toString("utf8") || "SECRET_HISTORY_EXPOSURE_POLICY_FAIL: git cat-file batch failed\n");
    process.exit(1);
  }

  let offset = 0;
  for (const item of chunk) {
    const newline = batch.stdout.indexOf(0x0a, offset);
    if (newline === -1) throw new Error("SECRET_HISTORY_EXPOSURE_POLICY_FAIL: malformed git batch header");
    const header = batch.stdout.subarray(offset, newline).toString("utf8");
    const parts = header.split(" ");
    const size = Number(parts[2]);
    const start = newline + 1;
    const end = start + size;
    const content = batch.stdout.subarray(start, end);
    offset = end + 1;

    if (content.includes(0x00)) continue;
    const source = content.toString("utf8");
    scanned += 1;
    const path = pathByObject.get(item.oid) ?? "<historical-blob>";

    for (const [detector, pattern] of detectors) {
      if (detector === "credentialed-database-url" && basename(path) === ".env.example") continue;
      if (pattern.test(source) && !isAllowed(item.oid, detector)) {
        violations.push(`${item.oid} ${path}: ${detector} detector matched`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("SECRET_HISTORY_EXPOSURE_POLICY_FAIL");
  for (const violation of violations) console.error(violation);
  process.exit(1);
}

console.log(`SECRET_HISTORY_EXPOSURE_POLICY_PASS: ${scanned} historical text blob(s) scanned`);
