import assert from "node:assert/strict";
import {
  BITRIX24_REQUEST_FAILED,
  getBitrix24ItemFields,
  type Bitrix24WebhookConfig,
} from "@/server/integrations/bitrix24/core";
import {
  BITRIX24_CASE_SCHEMA_CONFIG_ERROR,
  readBitrix24CaseSchemaConfig,
} from "@/server/integrations/bitrix24/case-schema-config";

const parsed = readBitrix24CaseSchemaConfig({
  BITRIX24_CASE_ENTITY_TYPE_ID: "128",
  BITRIX24_CASE_REQUIRED_WRITABLE_FIELDS: "title,stageId,ufCrm128_123",
});
assert.deepEqual(parsed, {
  entityTypeId: 128,
  requiredWritableFields: ["title", "stageId", "ufCrm128_123"],
});

for (const env of [
  { BITRIX24_CASE_ENTITY_TYPE_ID: "0", BITRIX24_CASE_REQUIRED_WRITABLE_FIELDS: "title" },
  { BITRIX24_CASE_ENTITY_TYPE_ID: "1.5", BITRIX24_CASE_REQUIRED_WRITABLE_FIELDS: "title" },
  { BITRIX24_CASE_ENTITY_TYPE_ID: "2", BITRIX24_CASE_REQUIRED_WRITABLE_FIELDS: "title,title" },
  { BITRIX24_CASE_ENTITY_TYPE_ID: "2", BITRIX24_CASE_REQUIRED_WRITABLE_FIELDS: "title,bad-field" },
]) {
  assert.throws(
    () => readBitrix24CaseSchemaConfig(env),
    new RegExp(BITRIX24_CASE_SCHEMA_CONFIG_ERROR),
  );
}

const webhookConfig: Bitrix24WebhookConfig = {
  portalOrigin: "https://iburo-staging.bitrix24.ru",
  userId: "17",
  webhookSecret: "stageWebhookSecret123",
  requestTimeoutMs: 1_000,
};

const fields = await getBitrix24ItemFields(
  webhookConfig,
  128,
  async (_input, init) => {
    assert.equal(
      init?.body,
      JSON.stringify({ entityTypeId: 128, useOriginalUfNames: "N" }),
    );
    return new Response(
      JSON.stringify({
        result: {
          fields: {
            title: {
              type: "string",
              isRequired: false,
              isReadOnly: false,
              isImmutable: false,
              title: "Must not escape helper",
              settings: { secretLikeMetadata: "must not escape helper" },
            },
            id: {
              type: "integer",
              isRequired: false,
              isReadOnly: true,
              isImmutable: false,
              title: "ID",
            },
          },
        },
      }),
      { status: 200 },
    );
  },
);

assert.deepEqual(fields, {
  title: {
    type: "string",
    isRequired: false,
    isReadOnly: false,
    isImmutable: false,
  },
  id: {
    type: "integer",
    isRequired: false,
    isReadOnly: true,
    isImmutable: false,
  },
});
assert.equal("title" in fields.title, false);
assert.equal("settings" in fields.title, false);

await assert.rejects(
  () => getBitrix24ItemFields(webhookConfig, 0),
  new RegExp(`${BITRIX24_REQUEST_FAILED}:INVALID_REQUEST`),
);

console.log("BITRIX24_SCHEMA_TEST_PASS");
