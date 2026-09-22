import assert from "node:assert/strict";
import test from "node:test";
import { assertStagingScannerFixtureKeysAbsent } from "../scripts/staging-scanner-fixture-ownership";

const keys = ["security-fixtures/file-scanner/run/clean.txt", "security-fixtures/file-scanner/run/eicar.txt"];

test("checks only exact synthetic keys and permits both missing", async () => {
  const checked: string[] = [];
  await assertStagingScannerFixtureKeysAbsent(keys, async (key) => {
    checked.push(key);
    return null;
  });
  assert.deepEqual(checked, keys);
});

test("fails closed when a fixture key already has an object", async () => {
  const checked: string[] = [];
  await assert.rejects(
    assertStagingScannerFixtureKeysAbsent(keys, async (key) => {
      checked.push(key);
      return key === keys[1] ? { sizeBytes: 64 } : null;
    }),
    /STAGING_SCANNER_FIXTURE_ALREADY_EXISTS/,
  );
  assert.deepEqual(checked, keys);
});

test("does not continue after occupied first key", async () => {
  const checked: string[] = [];
  await assert.rejects(
    assertStagingScannerFixtureKeysAbsent(keys, async (key) => {
      checked.push(key);
      return { sizeBytes: 1 };
    }),
    /STAGING_SCANNER_FIXTURE_ALREADY_EXISTS/,
  );
  assert.deepEqual(checked, [keys[0]]);
});

test("fails closed if private storage cannot be inspected", async () => {
  await assert.rejects(
    assertStagingScannerFixtureKeysAbsent(keys, async () => {
      throw new Error("metadata unavailable");
    }),
    /metadata unavailable/,
  );
});
