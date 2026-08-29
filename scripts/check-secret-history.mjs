import { execFileSync, spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { readFileSync } from "node:fs";

const MAX_TEXT_BYTES = 1024 * 1024;
const ALLOWED_ENV_FILES = new Set([".env.example"]);
const refs = process.argv.slice(2);

if (refs.length === 0) {
  console.error("SECRET_HISTORY_POLICY_FAIL: at least one Git ref is required");
  process.exit(1);
}

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

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function isAllowed(path, detector) {
  return Array.isArray(allowlist[path]) && allowlist[path].includes(detector);
}

function listCommits() {
  return git(["rev-list", "--topo-order", ...refs])
    .split(/\r?\n/)
    .filter(Boolean);
}

function listTree(commit) {
  const output = git(["ls-tree", "-r", "-z", "--full-tree", commit]);
  return output
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^\d+\s+blob\s+([0-9a-f]{40})\t(.+)$/s);
      return match ? { blob: match[1], path: match[2] } : null;
    })
    .filter(Boolean);
}

function blobSize(blob) {
  const value = git(["cat-file", "-s", blob]).trim();
  const size = Number(value);
  return Number.isSafeInteger(size) && size >= 0 ? size : null;
}

function readBlob(blob) {
  const result = spawnSync("git", ["cat-file", "blob", blob], {
    encoding: "utf8",
    maxBuffer: MAX_TEXT_BYTES + 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return null;
  return result.stdout;
}

const violations = [];
const scannedObjects = new Set();
let scannedBlobPaths = 0;
const commits = listCommits();

for (const commit of commits) {
  for (const { blob, path } of listTree(commit)) {
    const identity = `${blob}\0${path}`;
    if (scannedObjects.has(identity)) continue;
    scannedObjects.add(identity);

    const name = basename(path);
    if (/^\.env(?:\.|$)/.test(name) && !ALLOWED_ENV_FILES.has(name)) {
      violations.push(`${commit.slice(0, 12)} ${path}: tracked environment file is forbidden`);
      continue;
    }

    const size = blobSize(blob);
    if (size === null || size > MAX_TEXT_BYTES) continue;

    const source = readBlob(blob);
    if (source === null || source.includes("\u0000")) continue;
    scannedBlobPaths += 1;

    for (const [detector, pattern] of detectors) {
      if (pattern.test(source) && !isAllowed(path, detector)) {
        violations.push(`${commit.slice(0, 12)} ${path}: ${detector} detector matched`);
      }
    }

    if (name !== ".env.example") {
      const detector = "credentialed-database-url";
      const pattern = /postgres(?:ql)?:\/\/[^:\s/@]+:[^@\s/]+@/i;
      if (pattern.test(source) && !isAllowed(path, detector)) {
        violations.push(`${commit.slice(0, 12)} ${path}: ${detector} detector matched`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("SECRET_HISTORY_POLICY_FAIL");
  for (const violation of [...new Set(violations)].sort()) console.error(violation);
  process.exit(1);
}

console.log(
  `SECRET_HISTORY_POLICY_PASS: ${commits.length} commit(s), ${scannedBlobPaths} historical text blob/path pair(s) scanned`,
);
