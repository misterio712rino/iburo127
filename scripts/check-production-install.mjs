import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const installRoot = process.argv[2];
if (!installRoot) {
  console.error("PRODUCTION_DEPENDENCY_GRAPH_FAIL: missing isolated install path");
  process.exit(1);
}

const requiredRuntimePackages = new Set([
  "next",
  "react",
  "better-auth",
  "@prisma/client",
  "@prisma/adapter-pg",
]);

const forbiddenReviewedResidualPackages = new Set([
  "prisma",
  "@prisma/config",
  "deepmerge-ts",
  "mysql2",
]);

const installed = new Map();

async function inspectPackage(packageDir) {
  try {
    const packageJson = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"));
    if (typeof packageJson.name === "string" && typeof packageJson.version === "string") {
      const versions = installed.get(packageJson.name) ?? new Set();
      versions.add(packageJson.version);
      installed.set(packageJson.name, versions);
    }
  } catch {
    // Ignore non-package directories and incomplete metadata; npm ci itself must succeed first.
  }

  await inspectNodeModules(join(packageDir, "node_modules"));
}

async function inspectNodeModules(nodeModulesDir) {
  let entries;
  try {
    entries = await readdir(nodeModulesDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ".bin") continue;
    const entryPath = join(nodeModulesDir, entry.name);

    if (entry.name.startsWith("@")) {
      let scopedEntries;
      try {
        scopedEntries = await readdir(entryPath, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const scopedEntry of scopedEntries) {
        if (!scopedEntry.isDirectory()) continue;
        const packageDir = join(entryPath, scopedEntry.name);
        const stat = await lstat(packageDir);
        if (!stat.isDirectory()) continue;
        await inspectPackage(packageDir);
      }
      continue;
    }

    const stat = await lstat(entryPath);
    if (!stat.isDirectory()) continue;
    await inspectPackage(entryPath);
  }
}

await inspectNodeModules(join(installRoot, "node_modules"));

for (const name of requiredRuntimePackages) {
  if (!installed.has(name)) {
    console.error(`PRODUCTION_DEPENDENCY_GRAPH_FAIL: expected runtime package missing: ${name}`);
    process.exit(1);
  }
}

for (const name of forbiddenReviewedResidualPackages) {
  if (installed.has(name)) {
    const versions = [...installed.get(name)].sort().join(",");
    console.error(`PRODUCTION_DEPENDENCY_GRAPH_FAIL: reviewed vulnerable dev package present in production install: ${name}@${versions}`);
    process.exit(1);
  }
}

console.log(
  `PRODUCTION_DEPENDENCY_GRAPH_PASS: ${installed.size} package name(s) inspected; reviewed Prisma CLI residual absent from isolated production install`,
);
