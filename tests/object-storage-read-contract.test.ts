import assert from "node:assert/strict";
import {
  assertSafeObjectReadLimit,
  collectBoundedPrivateObjectBytes,
  OBJECT_STORAGE_READ_INCOMPLETE,
  OBJECT_STORAGE_READ_INVALID_LIMIT,
  OBJECT_STORAGE_READ_TOO_LARGE,
  OBJECT_STORAGE_READ_UNAVAILABLE,
  PRIVATE_OBJECT_MAX_READ_BYTES,
} from "@/server/files/object-storage-contract";

async function* chunks(...values: Uint8Array[]) {
  for (const value of values) yield value;
}

assertSafeObjectReadLimit(PRIVATE_OBJECT_MAX_READ_BYTES);
assert.throws(() => assertSafeObjectReadLimit(0), new RegExp(OBJECT_STORAGE_READ_INVALID_LIMIT));
assert.throws(
  () => assertSafeObjectReadLimit(PRIVATE_OBJECT_MAX_READ_BYTES + 1),
  new RegExp(OBJECT_STORAGE_READ_INVALID_LIMIT),
);

assert.deepEqual(
  await collectBoundedPrivateObjectBytes({
    body: chunks(new Uint8Array([1, 2]), new Uint8Array([3])),
    expectedBytes: 3,
    maxBytes: 3,
  }),
  new Uint8Array([1, 2, 3]),
);
await assert.rejects(
  collectBoundedPrivateObjectBytes({
    body: chunks(new Uint8Array([1, 2, 3])),
    maxBytes: 2,
  }),
  new RegExp(OBJECT_STORAGE_READ_TOO_LARGE),
);
await assert.rejects(
  collectBoundedPrivateObjectBytes({
    body: chunks(new Uint8Array([1])),
    expectedBytes: 2,
    maxBytes: 2,
  }),
  new RegExp(OBJECT_STORAGE_READ_INCOMPLETE),
);
await assert.rejects(
  collectBoundedPrivateObjectBytes({ body: null, maxBytes: 2 }),
  new RegExp(OBJECT_STORAGE_READ_UNAVAILABLE),
);
await assert.rejects(
  collectBoundedPrivateObjectBytes({ body: chunks(new Uint8Array()), maxBytes: 2 }),
  new RegExp(OBJECT_STORAGE_READ_INCOMPLETE),
);
await assert.rejects(
  collectBoundedPrivateObjectBytes({
    body: chunks(new Uint8Array([1])),
    expectedBytes: 3,
    maxBytes: 2,
  }),
  new RegExp(OBJECT_STORAGE_READ_TOO_LARGE),
);

console.log("Object storage bounded read contract tests: PASS");
