import "dotenv/config";

import {
  AI_PROVIDER_CONFIG_ERROR,
  readAiProviderName,
} from "@/server/ai/provider-config-core";

const STAGING_AI_VERIFY_FAIL = "STAGING_AI_VERIFY_FAIL";

function fail(message: string): never {
  console.error(`${STAGING_AI_VERIFY_FAIL}: ${message}`);
  process.exit(1);
}

let provider;
try {
  provider = readAiProviderName(process.env);
} catch (error) {
  const code =
    error instanceof Error && error.message.startsWith(`${AI_PROVIDER_CONFIG_ERROR}:`)
      ? error.message
      : `${AI_PROVIDER_CONFIG_ERROR}:UNEXPECTED`;
  fail(code);
}

if (provider === "yandex") {
  await import("@/scripts/verify-staging-yandex-ai");
} else {
  await import("@/scripts/verify-staging-openai-provider");
}
