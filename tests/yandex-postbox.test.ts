import assert from "node:assert/strict";
import { readYandexPostboxConfig } from "@/server/config/production";
import {
  EMAIL_DELIVERY_FAILED,
  sendYandexPostboxEmail,
  type YandexPostboxFetch,
  type YandexPostboxTransportConfig,
} from "@/server/email/yandex-postbox-core";

const config: YandexPostboxTransportConfig = {
  fromEmail: "staging@example.com",
  region: "ru-central1",
  endpoint: "https://postbox.cloud.yandex.net",
  host: "postbox.cloud.yandex.net",
  accessKeyId: "test-access-key-id",
  secretAccessKey: "test-secret-access-key",
  requestTimeoutMs: 50,
};

const productionEnv: NodeJS.ProcessEnv = {
  YANDEX_POSTBOX_FROM_EMAIL: "sender@example.com",
  YANDEX_POSTBOX_ACCESS_KEY_ID: "production-access-key-id",
  YANDEX_POSTBOX_SECRET_ACCESS_KEY: "production-secret-access-key",
};

const productionConfig = readYandexPostboxConfig(productionEnv);
assert.equal(productionConfig.accessKeyId, "production-access-key-id");
assert.equal(productionConfig.secretAccessKey, "production-secret-access-key");
for (const [name, value] of [
  ["YANDEX_POSTBOX_ACCESS_KEY_ID", "production-access\nkey-id"],
  ["YANDEX_POSTBOX_SECRET_ACCESS_KEY", "production-secret\0access-key"],
] as const) {
  assert.throws(
    () => readYandexPostboxConfig({ ...productionEnv, [name]: value }),
    new RegExp(`PRODUCTION_CONFIG_ERROR:${name}`),
  );
}

let capturedUrl = "";
let capturedInit: RequestInit | undefined;
const successFetch: YandexPostboxFetch = async (url, init) => {
  capturedUrl = String(url);
  capturedInit = init;
  return new Response("{}", { status: 200 });
};

await sendYandexPostboxEmail(
  config,
  {
    to: "recipient@example.com",
    subject: " Test subject ",
    text: " Test body ",
  },
  successFetch,
);

assert.equal(capturedUrl, "https://postbox.cloud.yandex.net/v2/email/outbound-emails");
assert.equal(capturedInit?.method, "POST");
assert.equal(capturedInit?.cache, "no-store");
assert.ok(capturedInit?.signal instanceof AbortSignal);
const capturedHeaders = capturedInit?.headers as Record<string, string>;
assert.match(capturedHeaders.authorization, /^AWS4-HMAC-SHA256 /);
assert.match(capturedHeaders["x-amz-date"], /^\d{8}T\d{6}Z$/);
const capturedPayload = JSON.parse(String(capturedInit?.body)) as {
  FromEmailAddress: string;
  Destination: { ToAddresses: string[] };
  Content: { Simple: { Subject: { Data: string }; Body: { Text: { Data: string } } } };
};
assert.equal(capturedPayload.FromEmailAddress, "staging@example.com");
assert.deepEqual(capturedPayload.Destination.ToAddresses, ["recipient@example.com"]);
assert.equal(capturedPayload.Content.Simple.Subject.Data, "Test subject");
assert.equal(capturedPayload.Content.Simple.Body.Text.Data, "Test body");

let unsafeCredentialFetchCalled = false;
const unsafeCredentialFetch: YandexPostboxFetch = async () => {
  unsafeCredentialFetchCalled = true;
  return new Response("{}", { status: 200 });
};
for (const unsafeConfig of [
  { ...config, accessKeyId: "test-access\nkey-id" },
  { ...config, secretAccessKey: "test-secret\0access-key" },
]) {
  await assert.rejects(
    sendYandexPostboxEmail(
      unsafeConfig,
      { to: "recipient@example.com", subject: "subject", text: "body" },
      unsafeCredentialFetch,
    ),
    (error: unknown) =>
      error instanceof Error && error.message === `${EMAIL_DELIVERY_FAILED}:INVALID_CONFIG`,
  );
}
assert.equal(unsafeCredentialFetchCalled, false, "unsafe credentials must fail before fetch");

const networkFetch: YandexPostboxFetch = async () => {
  throw new Error("raw transport secret must not escape");
};
await assert.rejects(
  sendYandexPostboxEmail(
    config,
    { to: "recipient@example.com", subject: "subject", text: "body" },
    networkFetch,
  ),
  (error: unknown) =>
    error instanceof Error && error.message === `${EMAIL_DELIVERY_FAILED}:NETWORK`,
);

const httpFetch: YandexPostboxFetch = async () => new Response("provider details", { status: 503 });
await assert.rejects(
  sendYandexPostboxEmail(
    config,
    { to: "recipient@example.com", subject: "subject", text: "body" },
    httpFetch,
  ),
  (error: unknown) =>
    error instanceof Error && error.message === `${EMAIL_DELIVERY_FAILED}:HTTP_503`,
);

const timeoutFetch: YandexPostboxFetch = async (_url, init) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) {
      reject(new Error("missing abort signal"));
      return;
    }
    if (signal.aborted) {
      reject(new Error("already aborted"));
      return;
    }
    signal.addEventListener("abort", () => reject(new Error("transport aborted")), { once: true });
  });

await assert.rejects(
  sendYandexPostboxEmail(
    { ...config, requestTimeoutMs: 5 },
    { to: "recipient@example.com", subject: "subject", text: "body" },
    timeoutFetch,
  ),
  (error: unknown) =>
    error instanceof Error && error.message === `${EMAIL_DELIVERY_FAILED}:TIMEOUT`,
);

await assert.rejects(
  sendYandexPostboxEmail(
    { ...config, endpoint: "https://example.com" as YandexPostboxTransportConfig["endpoint"] },
    { to: "recipient@example.com", subject: "subject", text: "body" },
    successFetch,
  ),
  (error: unknown) =>
    error instanceof Error && error.message === `${EMAIL_DELIVERY_FAILED}:INVALID_CONFIG`,
);

console.log("YANDEX_POSTBOX_TEST_PASS");
