import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PLATFORM_ROLE_CODES } from "@/server/domain/client-cases/contracts";

assert.deepEqual(PLATFORM_ROLE_CODES, ["CLIENT", "LAWYER", "MANAGER"]);

const seedSource = await readFile(resolve("prisma/seed.ts"), "utf8");
const actorRepositorySource = await readFile(
  resolve("server/repositories/prisma/actor-repository.ts"),
  "utf8",
);

assert.match(
  seedSource,
  /PLATFORM_ROLE_CODES\.map/,
  "reference seed must derive role rows from PLATFORM_ROLE_CODES",
);
assert.doesNotMatch(
  seedSource,
  /code:\s*["']ADMIN["']/,
  "reference seed must not create an unsupported ADMIN role",
);
assert.match(
  actorRepositorySource,
  /new Set<ActorRole>\(PLATFORM_ROLE_CODES\)/,
  "actor repository must reuse PLATFORM_ROLE_CODES",
);

console.log("PLATFORM_ROLE_CONTRACT_TEST_PASS");
