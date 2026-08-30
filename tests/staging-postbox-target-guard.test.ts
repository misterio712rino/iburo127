import assert from "node:assert/strict";
import {
  assertStagingPostboxTarget,
  STAGING_POSTBOX_SIMULATOR_RECIPIENT,
  STAGING_POSTBOX_TARGET_GUARD,
} from "@/scripts/staging-postbox-target-guard";

const validEnv: Readonly<Record<string, string | undefined>> = {
  IB_RUNTIME_TARGET: "staging",
  IB_EMAIL_TARGET: "staging",
  YANDEX_POSTBOX_FROM_EMAIL: "staging@example.com",
  IB_STAGING_POSTBOX_FROM_EMAIL: "staging@example.com",
  YANDEX_POSTBOX_ACCESS_KEY_ID: "staging-key-id",
  IB_STAGING_POSTBOX_ACCESS_KEY_ID: "staging-key-id",
  IB_STAGING_POSTBOX_CONFIRM: "SIMULATOR:staging@example.com",
};

assert.deepEqual(assertStagingPostboxTarget(validEnv), {
  fromEmail: "staging@example.com",
  accessKeyId: "staging-key-id",
});
assert.equal(STAGING_POSTBOX_SIMULATOR_RECIPIENT, "success@simulator.pstbx.ru");

for (const runtimeTarget of [undefined, "production"]) {
  assert.throws(
    () => assertStagingPostboxTarget({ ...validEnv, IB_RUNTIME_TARGET: runtimeTarget }),
    new RegExp(`${STAGING_POSTBOX_TARGET_GUARD}:RUNTIME_TARGET_NOT_STAGING`),
  );
}
assert.throws(
  () => assertStagingPostboxTarget({ ...validEnv, IB_EMAIL_TARGET: "production" }),
  new RegExp(`${STAGING_POSTBOX_TARGET_GUARD}:TARGET`),
);
assert.throws(
  () =>
    assertStagingPostboxTarget({
      ...validEnv,
      YANDEX_POSTBOX_FROM_EMAIL: "production@example.com",
    }),
  new RegExp(`${STAGING_POSTBOX_TARGET_GUARD}:FROM_EMAIL_MISMATCH`),
);
assert.throws(
  () =>
    assertStagingPostboxTarget({
      ...validEnv,
      YANDEX_POSTBOX_ACCESS_KEY_ID: "unexpected-key-id",
    }),
  new RegExp(`${STAGING_POSTBOX_TARGET_GUARD}:ACCESS_KEY_MISMATCH`),
);
assert.throws(
  () => assertStagingPostboxTarget({ ...validEnv, IB_STAGING_POSTBOX_CONFIRM: "" }),
  new RegExp(`${STAGING_POSTBOX_TARGET_GUARD}:CONFIRMATION`),
);

console.log("STAGING_POSTBOX_TARGET_GUARD_TEST_PASS");
