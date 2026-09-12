import "dotenv/config";

import {
  EMAIL_DELIVERY_FAILED,
  sendYandexPostboxEmail,
  type YandexPostboxTransportConfig,
} from "@/server/email/yandex-postbox-core";
import {
  assertStagingPostboxTarget,
  STAGING_POSTBOX_SIMULATOR_RECIPIENT,
} from "@/scripts/staging-postbox-target-guard";

const STAGING_POSTBOX_VERIFY_FAIL = "STAGING_POSTBOX_VERIFY_FAIL";

function fail(message: string): never {
  console.error(`${STAGING_POSTBOX_VERIFY_FAIL}: ${message}`);
  process.exit(1);
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) fail(`missing ${name}`);
  return value;
}

function readRequestTimeoutMs() {
  const raw = process.env.YANDEX_POSTBOX_REQUEST_TIMEOUT_MS?.trim();
  if (!raw) return 10_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1_000 || value > 30_000) {
    fail("YANDEX_POSTBOX_REQUEST_TIMEOUT_MS must be an integer between 1000 and 30000");
  }
  return value;
}

let target;
try {
  target = assertStagingPostboxTarget(process.env);
} catch (error) {
  const code =
    error instanceof Error && error.message.startsWith("STAGING_POSTBOX_TARGET_GUARD:")
      ? error.message
      : "STAGING_POSTBOX_TARGET_GUARD:UNEXPECTED";
  fail(code);
}

const config: YandexPostboxTransportConfig = {
  fromEmail: target.fromEmail,
  region: "ru-central1",
  endpoint: "https://postbox.cloud.yandex.net",
  host: "postbox.cloud.yandex.net",
  accessKeyId: target.accessKeyId,
  secretAccessKey: requireEnv("YANDEX_POSTBOX_SECRET_ACCESS_KEY"),
  requestTimeoutMs: readRequestTimeoutMs(),
};

try {
  await sendYandexPostboxEmail(config, {
    to: STAGING_POSTBOX_SIMULATOR_RECIPIENT,
    subject: "iBuro staging Postbox delivery check",
    text: "Automated staging-only Yandex Cloud Postbox delivery simulator verification.",
  });
  console.log("Staging Postbox target identity guard verified");
  console.log(`Simulator recipient: ${STAGING_POSTBOX_SIMULATOR_RECIPIENT}`);
  console.log("Real user recipients contacted: 0");
  console.log("STAGING_POSTBOX_VERIFY_PASS");
} catch (error) {
  const safeCode =
    error instanceof Error && error.message.startsWith(`${EMAIL_DELIVERY_FAILED}:`)
      ? error.message
      : `${EMAIL_DELIVERY_FAILED}:UNEXPECTED`;
  fail(safeCode);
}
