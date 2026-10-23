import assert from "node:assert/strict";
import test from "node:test";

import { classifyFileScanBacklogError } from "../server/staging/file-scan-backlog-diagnostic";

test("maps known Prisma connection, auth, timeout, schema, and transaction codes", () => {
  assert.equal(classifyFileScanBacklogError({ errorCode: "P1000" }), "DB_AUTH");
  assert.equal(classifyFileScanBacklogError({ code: "P1001" }), "DB_UNAVAILABLE");
  assert.equal(classifyFileScanBacklogError({ code: "P1002" }), "DB_TIMEOUT");
  assert.equal(classifyFileScanBacklogError({ cause: { code: "P2021" } }), "DB_SCHEMA");
  assert.equal(classifyFileScanBacklogError({ code: "P2034" }), "DB_TRANSACTION");
});

test("unknown errors collapse to a fixed safe diagnostic without exposing their message", () => {
  const diagnostic = classifyFileScanBacklogError(
    new Error("secret host, database name, and document data must never be returned"),
  );
  assert.equal(diagnostic, "DB_ERROR");
  assert.equal(JSON.stringify({ diagnostic }).includes("secret"), false);
});

test("does not trust unrecognized or malformed error codes", () => {
  assert.equal(classifyFileScanBacklogError({ code: "P9999", message: "secret" }), "DB_ERROR");
  assert.equal(classifyFileScanBacklogError(null), "DB_ERROR");
  assert.equal(classifyFileScanBacklogError("P1001"), "DB_ERROR");
});
