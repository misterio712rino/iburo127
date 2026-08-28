import assert from "node:assert/strict";
import {
  assertStagingBitrix24Target,
  bitrix24SecretFingerprint,
  STAGING_BITRIX24_TARGET_GUARD,
} from "@/scripts/staging-bitrix24-target-guard";

const secret = "stageWebhookSecret123";
const fingerprint = bitrix24SecretFingerprint(secret);
const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  IB_BITRIX24_TARGET: "staging",
  BITRIX24_PORTAL_ORIGIN: "https://iburo-staging.bitrix24.ru",
  IB_BITRIX24_ALLOWED_HOST: "iburo-staging.bitrix24.ru",
  BITRIX24_WEBHOOK_USER_ID: "17",
  BITRIX24_WEBHOOK_SECRET: secret,
  BITRIX24_REQUEST_TIMEOUT_MS: "10000",
  IB_STAGING_BITRIX24_PORTAL_ORIGIN: "https://iburo-staging.bitrix24.ru",
  IB_STAGING_BITRIX24_WEBHOOK_USER_ID: "17",
  IB_STAGING_BITRIX24_WEBHOOK_SECRET_SHA256: fingerprint,
  IB_STAGING_BITRIX24_CONFIRM: `BITRIX-VERIFY:iburo-staging.bitrix24.ru:17:${fingerprint}`,
};

const config = assertStagingBitrix24Target(baseEnv);
assert.equal(config.portalOrigin, "https://iburo-staging.bitrix24.ru");
assert.equal(config.userId, "17");
assert.equal(config.webhookSecret, secret);
assert.equal(config.requestTimeoutMs, 10_000);

for (const [name, override] of [
  ["target", { IB_BITRIX24_TARGET: "production" }],
  ["portal", { BITRIX24_PORTAL_ORIGIN: "https://prod.bitrix24.ru" }],
  ["allowed host", { IB_BITRIX24_ALLOWED_HOST: "prod.bitrix24.ru" }],
  ["user", { BITRIX24_WEBHOOK_USER_ID: "18" }],
  ["secret", { BITRIX24_WEBHOOK_SECRET: "differentSecret999" }],
  ["confirm", { IB_STAGING_BITRIX24_CONFIRM: "wrong" }],
] as const) {
  assert.throws(
    () => assertStagingBitrix24Target({ ...baseEnv, ...override }),
    new RegExp(STAGING_BITRIX24_TARGET_GUARD),
    name,
  );
}

assert.equal(bitrix24SecretFingerprint(secret).length, 64);
console.log("STAGING_BITRIX24_TARGET_GUARD_TEST_PASS");
