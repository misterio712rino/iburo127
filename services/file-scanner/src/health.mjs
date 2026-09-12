import { pingClamd } from "./clamd-client.mjs";
import { assertSignaturesFresh } from "./signature-freshness.mjs";

export async function checkHealth(config, dependencies = {}) {
  await (dependencies.assertSignaturesFresh ?? assertSignaturesFresh)(config);
  await (dependencies.pingClamd ?? pingClamd)(config);
}
