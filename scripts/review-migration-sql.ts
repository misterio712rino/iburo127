import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sqlPath = process.env.IB_MIGRATION_SQL_PATH?.trim();
if (!sqlPath) {
  console.error("MIGRATION_REVIEW_FAIL: missing IB_MIGRATION_SQL_PATH");
  process.exit(1);
}

const absolutePath = resolve(sqlPath);
const sql = await readFile(absolutePath, "utf8");
const normalized = sql.replace(/--.*$/gm, " ").replace(/\/\*[\s\S]*?\*\//g, " ");

const rules = [
  { code: "DROP_TABLE", pattern: /\bDROP\s+TABLE\b/i, severity: "BLOCK" },
  { code: "DROP_COLUMN", pattern: /\bDROP\s+COLUMN\b/i, severity: "BLOCK" },
  { code: "TRUNCATE", pattern: /\bTRUNCATE\b/i, severity: "BLOCK" },
  { code: "DELETE_WITHOUT_WHERE", pattern: /\bDELETE\s+FROM\s+[^;]+;/i, severity: "REVIEW" },
  { code: "ALTER_COLUMN_TYPE", pattern: /\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i, severity: "BLOCK" },
  { code: "DROP_TYPE", pattern: /\bDROP\s+TYPE\b/i, severity: "BLOCK" },
  { code: "ALTER_TYPE", pattern: /\bALTER\s+TYPE\b/i, severity: "REVIEW" },
  { code: "SET_NOT_NULL", pattern: /\bSET\s+NOT\s+NULL\b/i, severity: "REVIEW" },
  { code: "ADD_UNIQUE", pattern: /\bADD\s+CONSTRAINT\b[^;]*\bUNIQUE\b|\bCREATE\s+UNIQUE\s+INDEX\b/i, severity: "REVIEW" },
  { code: "CASCADE", pattern: /\bCASCADE\b/i, severity: "REVIEW" },
] as const;

const findings = rules
  .filter((rule) => rule.pattern.test(normalized))
  .map((rule) => ({ code: rule.code, severity: rule.severity }));

const checksum = createHash("sha256").update(sql).digest("hex");
const statements = normalized
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean).length;

console.log(`Migration SQL: ${absolutePath}`);
console.log(`SHA-256: ${checksum}`);
console.log(`Statements: ${statements}`);

if (findings.length === 0) {
  console.log("Findings: none from automated destructive-change heuristics");
  console.log("MIGRATION_REVIEW_PASS");
  process.exit(0);
}

for (const finding of findings) {
  console.log(`${finding.severity}: ${finding.code}`);
}

if (findings.some((finding) => finding.severity === "BLOCK")) {
  console.error("MIGRATION_REVIEW_BLOCKED: destructive or high-risk SQL requires explicit manual redesign/review");
  process.exit(2);
}

console.log("MIGRATION_REVIEW_REQUIRES_MANUAL_REVIEW");
process.exit(0);
