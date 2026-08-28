import assert from "node:assert/strict";
import { OpenAiResponsesGateway } from "@/server/ai/openai-responses-core";

const config = {
  apiKey: "sk-test-123456789012345678901234567890",
  model: "gpt-5.6-terra",
  endpoint: "https://api.openai.com/v1/responses" as const,
  requestTimeoutMs: 2_000,
  maxOutputTokens: 900,
};

const safetyIdentifier = "a".repeat(64);
const modelInput = {
  instructions: "System rules",
  messages: [{ role: "user" as const, content: "Hello" }],
  safetyIdentifier,
};

let capturedUrl = "";
let capturedInit: RequestInit | undefined;
const gateway = new OpenAiResponsesGateway(config, async (input, init) => {
  capturedUrl = String(input);
  capturedInit = init;
  return Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [
          { type: "output_text", text: "Первая часть." },
          { type: "output_text", text: "Вторая часть." },
        ],
      },
    ],
  });
});

const output = await gateway.reply(modelInput);
assert.equal(output, "Первая часть.\nВторая часть.");
assert.equal(capturedUrl, "https://api.openai.com/v1/responses");
assert.equal(capturedInit?.method, "POST");
const headers = new Headers(capturedInit?.headers);
assert.match(headers.get("authorization") ?? "", /^Bearer sk-test-/);
assert.ok(headers.get("x-client-request-id"));

const payload = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
assert.equal(payload.model, "gpt-5.6-terra");
assert.equal(payload.store, false);
assert.deepEqual(payload.tools, []);
assert.equal(payload.max_output_tokens, 900);
assert.equal(payload.safety_identifier, safetyIdentifier);
assert.equal(payload.instructions, "System rules");
assert.deepEqual(payload.input, [
  { role: "user", content: [{ type: "input_text", text: "Hello" }] },
]);

const httpFailure = new OpenAiResponsesGateway(config, async () =>
  new Response("provider detail must not escape", { status: 429 }),
);
await assert.rejects(() => httpFailure.reply(modelInput), /AI_PROVIDER_ERROR:HTTP_429/);

const invalidResponse = new OpenAiResponsesGateway(config, async () =>
  Response.json({ status: "completed", output: [] }),
);
await assert.rejects(() => invalidResponse.reply(modelInput), /AI_PROVIDER_ERROR:EMPTY_RESPONSE/);

for (const status of ["incomplete", "failed", "cancelled", "queued", "in_progress"] as const) {
  const nonCompletedResponse = new OpenAiResponsesGateway(config, async () =>
    Response.json({
      status,
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Do not accept partial output" }],
        },
      ],
    }),
  );
  await assert.rejects(
    () => nonCompletedResponse.reply(modelInput),
    new RegExp(`AI_PROVIDER_ERROR:RESPONSE_${status.toUpperCase()}`),
  );
}

const unknownStatus = new OpenAiResponsesGateway(config, async () =>
  Response.json({ status: "mystery", output: [] }),
);
await assert.rejects(() => unknownStatus.reply(modelInput), /AI_PROVIDER_ERROR:INVALID_RESPONSE/);

const networkFailure = new OpenAiResponsesGateway(config, async () => {
  throw new Error("raw network error with secret host details");
});
await assert.rejects(() => networkFailure.reply(modelInput), /AI_PROVIDER_ERROR:NETWORK/);

let invalidIdentifierFetchCalls = 0;
const invalidIdentifierGateway = new OpenAiResponsesGateway(config, async () => {
  invalidIdentifierFetchCalls += 1;
  throw new Error("fetch must not run");
});
await assert.rejects(
  () => invalidIdentifierGateway.reply({ ...modelInput, safetyIdentifier: "raw-user@example.test" }),
  /AI_PROVIDER_ERROR:INVALID_SAFETY_IDENTIFIER/,
);
assert.equal(invalidIdentifierFetchCalls, 0);

assert.throws(
  () =>
    new OpenAiResponsesGateway({
      ...config,
      endpoint: "https://evil.example/v1/responses" as "https://api.openai.com/v1/responses",
    }),
  /AI_PROVIDER_ERROR:INVALID_CONFIG/,
);

console.log("OPENAI_RESPONSES_TRANSPORT_TEST_PASS");
