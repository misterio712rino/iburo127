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

const forbiddenBodyReads = [
  /\brequest\.json\s*\(/,
  /\brequest\.text\s*\(/,
  /\brequest\.arrayBuffer\s*\(/,
  /\brequest\.blob\s*\(/,
  /\brequest\.formData\s*\(/,
  /\brequest\.body\b/,
];

for (const file of inspectedFiles) {
  const source = await readFile(file, "utf8");
  for (const pattern of forbiddenBodyReads) {
    assert.doesNotMatch(
      source,
      pattern,
      `${file} must use the shared bounded request-body boundary instead of reading Request body directly`,
    );
  }
}

const boundedWrapper = await readFile(
  resolve("server/http/bounded-json-body.ts"),
  "utf8",
);
assert.match(boundedWrapper, /PLATFORM_JSON_BODY_MAX_BYTES\s*=\s*64\s*\*\s*1024/);
assert.match(boundedWrapper, /readJsonBodyWithByteLimit/);
assert.match(boundedWrapper, /PAYLOAD_TOO_LARGE/);
assert.match(boundedWrapper, /\b413\b/);
assert.match(boundedWrapper, /privateJsonResponse/);

for (const requiredConsumer of [
  "server/questionnaire/route-adapter.ts",
  "server/practicum/route-adapter.ts",
  "server/documents/route-adapter.ts",
  "server/files/route-adapter.ts",
  "server/tasks/route-adapter.ts",
  "server/ai/route-adapter.ts",
  "app/api/platform/files/[fileId]/download/route.ts",
]) {
  const source = await readFile(resolve(requiredConsumer), "utf8");
  assert.match(
    source,
    /readBoundedJsonBody/,
    `${requiredConsumer} must use the bounded JSON body reader`,
  );
}

console.log(
  `PLATFORM_REQUEST_BODY_BOUNDARY_PASS: ${inspectedFiles.length} route/adapter file(s) inspected`,
);
