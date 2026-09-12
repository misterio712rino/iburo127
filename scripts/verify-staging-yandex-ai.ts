import "dotenv/config";

import { createHash } from "node:crypto";
import { AI_PROVIDER_ERROR, YandexGptGateway } from "@/server/ai/yandex-gpt-core";
import {
  assertStagingYandexAiTarget,
  STAGING_YANDEX_AI_TARGET_GUARD,
} from "@/scripts/staging-yandex-ai-target-guard";

const STAGING_AI_VERIFY_FAIL = "STAGING_AI_VERIFY_FAIL";
const EXPECTED_MARKER = "IB_AI_STAGING_OK";
const STAGING_SAFETY_IDENTIFIER = createHash("sha256")
  .update("iburo-staging-yandex-ai-connectivity-check", "utf8")
  .digest("hex");

function fail(message: string): never {
  console.error(`${STAGING_AI_VERIFY_FAIL}: ${message}`);
  process.exit(1);
}

function readInteger(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

let target;
try {
  target = assertStagingYandexAiTarget(process.env);
} catch (error) {
  const code =
    error instanceof Error && error.message.startsWith(`${STAGING_YANDEX_AI_TARGET_GUARD}:`)
      ? error.message
      : `${STAGING_YANDEX_AI_TARGET_GUARD}:UNEXPECTED`;
  fail(code);
}

const gateway = new YandexGptGateway({
  apiKey: target.apiKey,
  folderId: target.folderId,
  model: target.model,
  endpoint: "https://ai.api.cloud.yandex.net/foundationModels/v1/completion",
  requestTimeoutMs: readInteger("IB_AI_YANDEX_REQUEST_TIMEOUT_MS", 20_000, 1_000, 60_000),
  maxOutputTokens: 256,
  temperature: 0,
});

try {
  const response = await gateway.reply({
    instructions: [
      "This is an automated staging-only connectivity check for iBuro.",
      `Reply with exactly this marker and nothing else: ${EXPECTED_MARKER}`,
      "Do not request or output any personal, legal-case, authentication, or secret data.",
    ].join("\n"),
    messages: [{ role: "user", content: "Run the staging connectivity check." }],
    safetyIdentifier: STAGING_SAFETY_IDENTIFIER,
  });

  if (response.trim() !== EXPECTED_MARKER) {
    fail("UNEXPECTED_MODEL_OUTPUT");
  }

  console.log("Staging Yandex AI target guard verified");
  console.log("Client/case data included: 0");
  console.log("Provider response content logged: 0");
  console.log("Provider request data logging: disabled");
  console.log("STAGING_AI_VERIFY_PASS");
} catch (error) {
  const safeCode =
    error instanceof Error && error.message.startsWith(`${AI_PROVIDER_ERROR}:`)
      ? error.message
      : `${AI_PROVIDER_ERROR}:UNEXPECTED`;
  fail(safeCode);
}
