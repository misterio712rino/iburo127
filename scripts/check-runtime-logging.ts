import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOTS = ["app", "server", "components", "lib"];
const ROOT_RUNTIME_FILES = ["middleware.ts", "middleware.js", "proxy.ts", "proxy.js", "instrumentation.ts", "instrumentation.js"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const RULES = [
  {
    id: "DIRECT_CONSOLE",
    pattern: /\bconsole\s*\.\s*(?:log|info|warn|error|debug|trace|dir|table)\s*\(/g,
  },
  {
    id: "DIRECT_PROCESS_OUTPUT",
    pattern: /\bprocess\s*\.\s*(?:stdout|stderr)\s*\.\s*write\s*\(/g,
  },
] as const;

type Violation = {
  path: string;
  line: number;
  rule: (typeof RULES)[number]["id"];
};

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(path: string): Promise<string[]> {
  if (!(await exists(path))) return [];
  const entryStat = await stat(path);
  if (entryStat.isFile()) return SOURCE_EXTENSIONS.has(extname(path)) ? [path] : [];

  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "generated") continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(child)));
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(child);
  }
  return files;
}

function lineForOffset(source: string, offset: number) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

async function inspectFile(path: string): Promise<Violation[]> {
  const source = await readFile(path, "utf8");
  const violations: Violation[] = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (let match = rule.pattern.exec(source); match; match = rule.pattern.exec(source)) {
      violations.push({
        path: relative(process.cwd(), path).replaceAll("\\", "/"),
        line: lineForOffset(source, match.index),
        rule: rule.id,
      });
    }
  }

  return violations;
}

const files = [
  ...(await Promise.all(ROOTS.map((root) => collectFiles(root)))).flat(),
  ...(await Promise.all(ROOT_RUNTIME_FILES.map((path) => collectFiles(path)))).flat(),
];

const violations = (await Promise.all(files.map(inspectFile)))
  .flat()
  .sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line);

if (violations.length > 0) {
  console.error(`RUNTIME_LOGGING_GATE_FAIL: ${violations.length} direct runtime output call(s) found.`);
  for (const violation of violations) {
    console.error(`${violation.path}:${violation.line} ${violation.rule}`);
  }
  console.error("Runtime code must not write raw errors, request data, PII or secrets directly to console/stdout/stderr.");
  console.error("Use an explicitly reviewed structured logger with metadata allowlisting/redaction before adding production logging.");
  process.exit(1);
}

console.log(`RUNTIME_LOGGING_GATE_PASS: ${files.length} runtime source file(s) inspected.`);
