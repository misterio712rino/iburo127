import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const requestedRefs = process.argv.slice(3);
const refs = requestedRefs.length > 0 ? requestedRefs : ["HEAD"];
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

function displayPath(path) {
  return JSON.stringify(path);
}

function isAllowed(path, blobSha, detector) {
  const byPath = allowlist[path];
  return Boolean(
    byPath &&
      typeof byPath === "object" &&
      !Array.isArray(byPath) &&
      Array.isArray(byPath[blobSha]) &&
      byPath[blobSha].includes(detector),
  );
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

const shallow = git(["rev-parse", "--is-shallow-repository"]).trim();
if (shallow !== "false") {
  console.error("SECRET_HISTORY_EXPOSURE_POLICY_FAIL: repository history is shallow");
  process.exit(1);
}

for (const ref of refs) {
  try {
    git(["rev-parse", "--verify", `${ref}^{commit}`]);
  } catch {
    console.error(`SECRET_HISTORY_EXPOSURE_POLICY_FAIL: required ref is unavailable: ${ref}`);
    process.exit(1);
  }
}

const commits = git(["rev-list", "--topo-order", ...refs])
  .split(/\r?\n/)
  .filter(Boolean);
const pairs = new Map();
for (const commit of commits) {
  for (const { blob, path } of listTree(commit)) {
    const key = `${blob}\0${path}`;
    if (!pairs.has(key)) pairs.set(key, { blob, path, commit });
  }
}

const violations = [];
for (const { blob, path, commit } of pairs.values()) {
  const name = basename(path);
  if (/^\.env(?:\.|$)/.test(name) && !ALLOWED_ENV_FILES.has(name)) {
    violations.push(
      `${commit} ${displayPath(path)}: tracked environment file existed in candidate history (blob ${blob})`,
    );
  }
}

const uniqueBlobIds = [...new Set([...pairs.values()].map(({ blob }) => blob))];
const check = spawnSync(
  "git",
  ["-C", root, "cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
  {
    input: `${uniqueBlobIds.join("\n")}\n`,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  },
);
if (check.status !== 0) {
  process.stderr.write(
    check.stderr || "SECRET_HISTORY_EXPOSURE_POLICY_FAIL: git cat-file check failed\n",
  );
  process.exit(1);
}

const eligibleBlobIds = new Set(
  check.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [oid, type, sizeText] = line.split(" ");
      return { oid, type, size: Number(sizeText) };
    })
    .filter(
      (item) =>
        item.type === "blob" && Number.isFinite(item.size) && item.size <= MAX_TEXT_BYTES,
    )
    .map((item) => item.oid),
);

const sources = new Map();
const eligible = [...eligibleBlobIds];
for (let index = 0; index < eligible.length; index += 25) {
  const chunk = eligible.slice(index, index + 25);
  const batch = spawnSync("git", ["-C", root, "cat-file", "--batch"], {
    input: `${chunk.join("\n")}\n`,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (batch.status !== 0 || !batch.stdout) {
    process.stderr.write(
      batch.stderr?.toString("utf8") ||
        "SECRET_HISTORY_EXPOSURE_POLICY_FAIL: git cat-file batch failed\n",
    );
    process.exit(1);
  }

  let offset = 0;
  for (const oid of chunk) {
    const newline = batch.stdout.indexOf(0x0a, offset);
    if (newline === -1) {
      throw new Error("SECRET_HISTORY_EXPOSURE_POLICY_FAIL: malformed git batch header");
    }
    const header = batch.stdout.subarray(offset, newline).toString("utf8");
    const [returnedOid, type, sizeText] = header.split(" ");
    const size = Number(sizeText);
    if (returnedOid !== oid || type !== "blob" || !Number.isSafeInteger(size) || size < 0) {
      throw new Error("SECRET_HISTORY_EXPOSURE_POLICY_FAIL: unexpected git batch object");
    }
    const start = newline + 1;
    const end = start + size;
    const content = batch.stdout.subarray(start, end);
    offset = end + 1;

    if (content.includes(0x00)) continue;
    sources.set(oid, content.toString("utf8"));
  }
}

let scannedPairs = 0;
for (const { blob, path, commit } of pairs.values()) {
  const source = sources.get(blob);
  if (source === undefined) continue;
  scannedPairs += 1;

  for (const [detector, pattern] of detectors) {
    if (detector === "credentialed-database-url" && basename(path) === ".env.example") continue;
    if (pattern.test(source) && !isAllowed(path, blob, detector)) {
      violations.push(
        `${commit} ${displayPath(path)}: ${detector} detector matched (blob ${blob})`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("SECRET_HISTORY_EXPOSURE_POLICY_FAIL");
  for (const violation of [...new Set(violations)].sort()) console.error(violation);
  process.exit(1);
}

console.log(
  `SECRET_HISTORY_EXPOSURE_POLICY_PASS: refs=${refs.join(",")} ${scannedPairs} historical text blob/path pair(s) scanned`,
);
