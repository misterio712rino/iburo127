import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const srcRoot = resolve("services/file-scanner/src");
const runtimeFiles = readdirSync(srcRoot)
  .filter((name) => name.endsWith(".mjs"))
  .sort();

const directOutputPattern = /\b(?:console\.(?:log|warn|error|debug|trace|dir|table)|process\.(?:stdout|stderr)\.write)\s*\(/g;
const consoleInfoPattern = /\bconsole\.info\s*\(/g;

test("scanner runtime logging stays on the reviewed structured allowlist", () => {
  const observedInfoFiles = [];

  for (const fileName of runtimeFiles) {
    const source = readFileSync(resolve(srcRoot, fileName), "utf8");
    assert.doesNotMatch(
      source,
      directOutputPattern,
      `${fileName} must not add raw console/process output; scanner logs require an explicit structured allowlist review`,
    );

    const infoCalls = source.match(consoleInfoPattern) ?? [];
    if (infoCalls.length > 0) observedInfoFiles.push([fileName, infoCalls.length]);
  }

  assert.deepEqual(
    observedInfoFiles,
    [
      ["server.mjs", 1],
      ["service.mjs", 1],
    ],
    "scanner runtime may emit console.info only through the two reviewed structured logging sites",
  );

  const serviceSource = readFileSync(resolve(srcRoot, "service.mjs"), "utf8");
  assert.match(
    serviceSource,
    /function defaultLogger\(event, category\) \{\s*const record = category \? \{ event, category \} : \{ event \};\s*console\.info\(JSON\.stringify\(record\)\);\s*\}/,
    "request logging must serialize only the reviewed event/category fields",
  );
  assert.match(serviceSource, /logger\("scan_complete", verdict === "CLEAN" \? "clean" : "malicious"\);/);
  assert.match(serviceSource, /logger\("request_failed", safe\.category\);/);
  assert.doesNotMatch(
    serviceSource,
    /logger\([^\n]*(?:sourceUrl|request|headers|secret|token|error\.message|stack)/i,
    "scanner logger calls must not receive source capabilities, request data, credentials or raw errors",
  );

  const serverSource = readFileSync(resolve(srcRoot, "server.mjs"), "utf8");
  assert.match(
    serverSource,
    /console\.info\(JSON\.stringify\(\{ event: "service_started" \}\)\);/,
    "service startup logging must remain a static event-only record",
  );
});
