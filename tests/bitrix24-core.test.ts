import assert from "node:assert/strict";
import {
  BITRIX24_REQUEST_FAILED,
  callBitrix24Webhook,
  getBitrix24MethodAvailability,
  getBitrix24ProfileIdentity,
  type Bitrix24Fetch,
  type Bitrix24WebhookConfig,
} from "@/server/integrations/bitrix24/core";

const config: Bitrix24WebhookConfig = {
  portalOrigin: "https://iburo-staging.bitrix24.ru",
  userId: "17",
  webhookSecret: "stageWebhookSecret123",
  requestTimeoutMs: 1_000,
};

let capturedUrl = "";
let capturedBody = "";
const profileFetch: Bitrix24Fetch = async (input, init) => {
  capturedUrl = String(input);
  capturedBody = String(init?.body ?? "");
  assert.equal(init?.method, "POST");
  assert.equal(init?.cache, "no-store");
  return new Response(
    JSON.stringify({
      result: {
        ID: "17",
        ADMIN: false,
        NAME: "Should not be returned by helper",
        LAST_NAME: "Should not be returned by helper",
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};

const profile = await getBitrix24ProfileIdentity(config, profileFetch);
assert.deepEqual(profile, { id: "17", admin: false });
assert.equal(
  capturedUrl,
  "https://iburo-staging.bitrix24.ru/rest/17/stageWebhookSecret123/profile",
);
assert.equal(capturedBody, "{}");
assert.equal("NAME" in profile, false);

const availability = await getBitrix24MethodAvailability(
  config,
  "crm.item.add",
  async (_input, init) => {
    assert.equal(init?.body, JSON.stringify({ name: "crm.item.add" }));
    return new Response(
      JSON.stringify({ result: { isExisting: true, isAvailable: true } }),
      { status: 200 },
    );
  },
);
assert.deepEqual(availability, { isExisting: true, isAvailable: true });

try {
  await callBitrix24Webhook(
    config,
    "profile",
    {},
    async () => {
      throw new Error(`network leaked ${config.webhookSecret}`);
    },
  );
  assert.fail("network failure must reject");
} catch (error) {
  assert.equal(error instanceof Error ? error.message : "", `${BITRIX24_REQUEST_FAILED}:NETWORK`);
}

try {
  await callBitrix24Webhook(
    config,
    "profile",
    {},
    async () =>
      new Response(
        JSON.stringify({
          error: "INVALID_CREDENTIALS",
          error_description: `must never escape ${config.webhookSecret}`,
        }),
        { status: 200 },
      ),
  );
  assert.fail("provider failure must reject");
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  assert.equal(message, `${BITRIX24_REQUEST_FAILED}:PROVIDER_INVALID_CREDENTIALS`);
  assert.doesNotMatch(message, /stageWebhookSecret123/);
}

await assert.rejects(
  () => callBitrix24Webhook(config, "profile", {}, async () => new Response("forbidden", { status: 403 })),
  new RegExp(`${BITRIX24_REQUEST_FAILED}:HTTP_403`),
);

await assert.rejects(
  () =>
    callBitrix24Webhook(
      { ...config, portalOrigin: "http://iburo-staging.bitrix24.ru" },
      "profile",
      {},
      profileFetch,
    ),
  new RegExp(`${BITRIX24_REQUEST_FAILED}:INVALID_CONFIG`),
);

await assert.rejects(
  () => callBitrix24Webhook(config, "evil.method" as never, {}, profileFetch),
  new RegExp(`${BITRIX24_REQUEST_FAILED}:METHOD_NOT_ALLOWED`),
);

console.log("BITRIX24_CORE_TEST_PASS");
