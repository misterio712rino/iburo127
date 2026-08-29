import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

async function collectFiles(
  directory: string,
  include: (fileName: string) => boolean,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path, include)));
    } else if (entry.isFile() && include(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

const platformRoutes = await collectFiles(
  resolve("app/api/platform"),
  (name) => name === "route.ts",
);
const routeAdapters = await collectFiles(
  resolve("server"),
  (name) => name === "route-adapter.ts",
);
const inspectedFiles = [...platformRoutes, ...routeAdapters];
assert.ok(platformRoutes.length > 0, "platform route inventory must not be empty");
assert.ok(routeAdapters.length > 0, "route-adapter inventory must not be empty");

const forbiddenDirectResponses: Array<[RegExp, string]> = [
  [/\bResponse\.json\s*\(/, "Response.json"],
  [/\bNextResponse\.json\s*\(/, "NextResponse.json"],
  [/\bNextResponse\.redirect\s*\(/, "NextResponse.redirect"],
  [/\bnew\s+Response\s*\(/, "new Response"],
];

for (const file of inspectedFiles) {
  const source = await readFile(file, "utf8");
  for (const [pattern, label] of forbiddenDirectResponses) {
    assert.doesNotMatch(
      source,
      pattern,
      `${file} must not use ${label}; authenticated platform routes/adapters must return through the shared private transport boundary`,
    );
  }
  assert.doesNotMatch(
    source,
    /\bCache-Control\b[\s\S]{0,80}\bpublic\b/i,
    `${file} must not declare public cache semantics`,
  );
  assert.doesNotMatch(
    source,
    /\bs-maxage\b/i,
    `${file} must not declare shared-cache s-maxage`,
  );
}

const helper = await readFile(resolve("server/http/private-json.ts"), "utf8");
assert.match(helper, /"Cache-Control":\s*"private, no-store, max-age=0"/);
assert.match(helper, /Pragma:\s*"no-cache"/);
assert.match(helper, /"X-Content-Type-Options":\s*"nosniff"/);
assert.match(helper, /Response\.json\(body/);

console.log(
  `PLATFORM_PRIVATE_RESPONSE_BOUNDARY_PASS: ${inspectedFiles.length} route/adapter file(s) inspected`,
);
